import "server-only";
import { mongo, Types } from "mongoose";
import { buildClosingFigures, closeBlock, committedAmount, isMonthLocked, type ClosingFigures, type CloseBlock } from "@/lib/closing";
import { currentMonth, monthKey, monthRange, shiftMonth, type MonthKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import { AppError, type ServerErrorCode } from "@/lib/errors";
import { NOT_FROM_REGISTER } from "@/lib/contributions";
import { COUNTED_APPROVAL_STATUSES } from "@/lib/payouts";
import { Account, AidCase, Disbursement, Expense, Income, MonthClosing, Transfer, type MonthClosingDoc } from "@/models";
import { accountBalance, movementsByAccount, NO_MOVEMENTS } from "./account-totals";
import { readSettings } from "./settings";

// Month closing and locked months. Internal: no session checks. Used by the
// services in closing.ts and by the seed.

/** The latest closed month; it and every month before it are locked. null if none is closed. */
export async function lockedThrough(): Promise<MonthKey | null> {
  await connectDB();
  const latest = await MonthClosing.findOne({ status: "closed" }).sort({ month: -1 }).select("month").lean();
  return latest?.month ?? null;
}

/** Whether an entry dated `date` falls in a locked month. */
export async function isDateLocked(date: Date): Promise<boolean> {
  return isMonthLocked(monthKey(date), await lockedThrough());
}

/**
 * Refuses any new, changed or cancelled entry dated in a closed month. Call it
 * before every write that touches income, aid payments, expenses or transfers.
 */
export async function assertDateOpen(date: Date): Promise<void> {
  if (await isDateLocked(date)) throw new AppError("monthLocked");
}

/** Month of the oldest dated money entry (payment, aid payment, expense or transfer). null if there are none. */
export async function firstEntryMonth(): Promise<MonthKey | null> {
  await connectDB();
  const oldest = await Promise.all([
    Income.findOne(NOT_FROM_REGISTER).sort({ date: 1 }).select("date").lean(),
    Disbursement.findOne().sort({ date: 1 }).select("date").lean(),
    Expense.findOne().sort({ date: 1 }).select("date").lean(),
    Transfer.findOne().sort({ date: 1 }).select("date").lean(),
  ]);
  const dates = oldest.flatMap((row) => (row ? [row.date.getTime()] : []));
  return dates.length ? monthKey(Math.min(...dates)) : null;
}

/**
 * The first month of the books: the first month set in the opening setup, or
 * (before setup) the month of the oldest money entry. null when neither exists.
 */
export async function booksStartMonth(): Promise<MonthKey | null> {
  const { setup } = await readSettings();
  return setup.firstMonth ?? (await firstEntryMonth());
}

/** Aid payments dated up to the end of `month` that still wait for a second head. */
export async function pendingApprovalsThrough(month: MonthKey): Promise<number> {
  await connectDB();
  return Disbursement.countDocuments({ approvalStatus: "pending", date: { $lt: monthRange(month).end } });
}

/** Approved but unpaid money on cases open at `asOf`, counting payments dated before it. */
export async function committedAt(asOf: Date): Promise<number> {
  await connectDB();
  // A case gets an approved amount when approved and keeps it; cases never approved commit nothing.
  const cases = await AidCase.find({ approvedAmount: { $ne: null } }).select("statusHistory").lean();
  if (cases.length === 0) return 0;
  const paid = await Disbursement.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { caseId: { $in: cases.map((c) => c._id) }, approvalStatus: { $in: [...COUNTED_APPROVAL_STATUSES] }, date: { $lt: asOf } } },
    { $group: { _id: "$caseId", total: { $sum: "$amount" } } },
  ]);
  const paidByCase = new Map(paid.map((row) => [row._id.toString(), row.total]));
  return committedAmount(
    cases.map((c) => ({
      history: c.statusHistory.map((h) => ({ status: h.status, approvedAmount: h.approvedAmount ?? null, changedAt: h.changedAt })),
      paid: paidByCase.get(c._id.toString()) ?? 0,
    })),
    asOf,
  );
}

export type AccountBalanceAt = { accountId: string; name: string; balance: number };

export type MonthFigures = {
  figures: ClosingFigures;
  /** Balance of every account at month end. */
  accountBalances: AccountBalanceAt[];
  /** Where the opening balance came from. */
  openingFrom: "previousClosing" | "accounts";
};

/**
 * The books of `month` as they stand now. The opening balance is the previous
 * month's closing when that month is closed; otherwise the accounts' opening
 * balances plus everything dated before the month. Committed money is worked
 * out at month end (or now, for the running month).
 */
export async function computeMonthFigures(month: MonthKey, now = new Date()): Promise<MonthFigures> {
  await connectDB();
  const { start, end } = monthRange(month);
  const asOf = end.getTime() < now.getTime() ? end : now;
  const [accounts, inMonth, throughEnd, previous, settings, committed] = await Promise.all([
    Account.find().select("name openingBalance").sort({ createdAt: 1 }).lean(),
    movementsByAccount(undefined, { from: start, to: end }),
    movementsByAccount(undefined, { to: end }),
    MonthClosing.findOne({ month: shiftMonth(month, -1), status: "closed" }).select("closingBalance").lean(),
    readSettings(),
    committedAt(asOf),
  ]);

  let totalIncome = 0;
  let totalDisbursed = 0;
  let totalExpenses = 0;
  for (const m of inMonth.values()) {
    totalIncome += m.income;
    totalDisbursed += m.disbursed;
    totalExpenses += m.expenses;
  }
  const accountBalances = accounts.map((a) => {
    const moved = throughEnd.get(a._id.toString()) ?? NO_MOVEMENTS;
    return { accountId: a._id.toString(), name: a.name, balance: accountBalance({ openingBalance: a.openingBalance, ...moved }) };
  });
  // Transfers between the fund's own accounts cancel out in the total.
  const totalAtEnd = accountBalances.reduce((sum, a) => sum + a.balance, 0);
  const computedOpening = totalAtEnd - (totalIncome - totalDisbursed - totalExpenses);

  return {
    figures: buildClosingFigures({
      openingBalance: previous ? previous.closingBalance : computedOpening,
      totalIncome,
      totalDisbursed,
      totalExpenses,
      committedAmount: committed,
      emergencyReserve: settings.emergencyReserve,
    }),
    accountBalances,
    openingFrom: previous ? "previousClosing" : "accounts",
  };
}

export const CLOSE_BLOCK_ERRORS: Record<CloseBlock, ServerErrorCode> = {
  alreadyClosed: "monthAlreadyClosed",
  notEnded: "monthNotEnded",
  closePreviousFirst: "closePreviousFirst",
  pendingApprovals: "pendingApprovalsInMonth",
};

/** Why `month` cannot be closed now, or null. */
export async function closeBlockFor(month: MonthKey): Promise<CloseBlock | null> {
  const [locked, first, pending] = await Promise.all([lockedThrough(), booksStartMonth(), pendingApprovalsThrough(month)]);
  return closeBlock(month, { lockedThrough: locked, firstEntryMonth: first, current: currentMonth(), pendingApprovals: pending });
}

/**
 * Saves the month's figures and locks it. A month reopened earlier keeps its
 * document and history; its figures are replaced.
 */
export async function closeMonthCore(month: MonthKey, actorId: string | null): Promise<MonthClosingDoc> {
  const block = await closeBlockFor(month);
  if (block) throw new AppError(CLOSE_BLOCK_ERRORS[block]);
  const { figures, accountBalances } = await computeMonthFigures(month);

  const doc = await MonthClosing.findOneAndUpdate(
    { month, status: { $ne: "closed" } },
    {
      $set: {
        status: "closed",
        ...figures,
        accountBalances: accountBalances.map((a) => ({ ...a, accountId: new Types.ObjectId(a.accountId) })),
        closedBy: actorId ? new Types.ObjectId(actorId) : null,
        closedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  )
    .lean()
    .catch((error: unknown) => {
      // Someone else closed it a moment ago (the upsert hit the unique month).
      if (error instanceof mongo.MongoServerError && error.code === 11000) throw new AppError("monthAlreadyClosed");
      throw error;
    });
  if (!doc) throw new AppError("monthAlreadyClosed");
  return doc;
}
