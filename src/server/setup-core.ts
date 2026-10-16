import "server-only";
import { randomBytes } from "node:crypto";
import { mongo, Types } from "mongoose";
import { formatReceiptNo, REGISTER_INCOME_SOURCE } from "@/lib/contributions";
import { monthKey, monthRange, parseDateKey, type MonthKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import { AppError, type ServerErrorCode } from "@/lib/errors";
import type { CaseImportRow, HistoryImportRow } from "@/lib/validators";
import { Account, AidCase, ContributionBill, Income } from "@/models";
import { firstEntryMonth, lockedThrough } from "./closing-core";
import { nextCaseNo, nextSequence } from "./sequence";

// Opening setup and register imports. Internal: no session checks. Used by
// src/server/setup.ts, src/server/imports.ts and the seed.

/** Note on every record imported from the paper register. */
export const REGISTER_NOTE = "Imported from register";
/** Receipt numbers of imported register payments ("REG-0001"), kept apart from real receipts. */
export const REGISTER_RECEIPT_PREFIX = "REG-";

/** The opening setup can be changed until the first month is closed (and again if it is reopened). */
export async function assertSetupOpen(): Promise<void> {
  if (await lockedThrough()) throw new AppError("setupLocked");
}

/**
 * Why `firstMonth` cannot be the first month of the books: app entries or
 * bills dated before it, or register history dated on or after it.
 */
export async function firstMonthConflict(firstMonth: MonthKey): Promise<ServerErrorCode | null> {
  await connectDB();
  const [entry, appBill, registerBill, registerCase] = await Promise.all([
    firstEntryMonth(),
    ContributionBill.findOne({ origin: { $ne: "register" } }).sort({ month: 1 }).select("month").lean(),
    ContributionBill.findOne({ origin: "register" }).sort({ month: -1 }).select("month").lean(),
    AidCase.findOne({ importedFromRegister: true }).sort({ lastUpdateAt: -1 }).select("lastUpdateAt").lean(),
  ]);
  if ((entry && entry < firstMonth) || (appBill && appBill.month < firstMonth)) return "entriesBeforeFirstMonth";
  if ((registerBill && registerBill.month >= firstMonth) || (registerCase && monthKey(registerCase.lastUpdateAt) >= firstMonth)) {
    return "registerAfterFirstMonth";
  }
  return null;
}

/**
 * Account the register payments are filed under: the first cash account, else
 * the first account. The money is already in its opening balance, so these
 * records never change any balance.
 */
async function registerAccountId(): Promise<Types.ObjectId> {
  const accounts = await Account.find().select("type").sort({ createdAt: 1 }).lean();
  const account = accounts.find((a) => a.type === "cash_in_hand") ?? accounts[0];
  if (!account) throw new AppError("accountNotFound");
  return account._id;
}

export type RegisterPayment = HistoryImportRow & { memberId: Types.ObjectId };

/**
 * One fully paid bill (origin "register") and one Income (source
 * opening_balance, note "Imported from register") per row. A month that
 * already has a bill is skipped.
 */
export async function createRegisterPayments(rows: readonly RegisterPayment[], actorId: string): Promise<{ created: number; skipped: number; amount: number }> {
  await connectDB();
  const accountId = await registerAccountId();
  const actor = new Types.ObjectId(actorId);
  let created = 0;
  let skipped = 0;
  let amount = 0;

  for (const row of rows) {
    const bill = await ContributionBill.create({
      memberId: row.memberId,
      month: row.month,
      amount: row.amount,
      paidAmount: row.amount,
      status: "paid",
      origin: "register",
      createdBy: actor,
    }).catch((error: unknown) => {
      if (error instanceof mongo.MongoServerError && error.code === 11000) return null;
      throw error;
    });
    if (!bill) {
      skipped += 1;
      continue;
    }
    await Income.create({
      memberId: row.memberId,
      source: REGISTER_INCOME_SOURCE,
      amount: row.amount,
      accountId,
      billIds: [bill._id],
      monthsCovered: [row.month],
      allocations: [{ billId: bill._id, month: row.month, amount: row.amount }],
      openingDuePaid: 0,
      method: "cash",
      receivedBy: actor,
      receiptNumber: formatReceiptNo(await nextSequence("register"), REGISTER_RECEIPT_PREFIX),
      publicToken: randomBytes(16).toString("base64url"),
      date: (row.date ? parseDateKey(row.date) : null) ?? monthRange(row.month).start,
      note: REGISTER_NOTE,
    });
    created += 1;
    amount += row.amount;
  }
  return { created, skipped, amount };
}

/**
 * Old completed aid cases from the register: approved and completed on the
 * given day, with the total paid kept as registerPaidAmount (no disbursement,
 * so balances and monthly totals are untouched).
 */
export async function createRegisterCases(rows: readonly CaseImportRow[], actorId: string): Promise<{ created: number; amount: number }> {
  await connectDB();
  const actor = new Types.ObjectId(actorId);
  let amount = 0;
  for (const row of rows) {
    const day = parseDateKey(row.date) ?? new Date();
    await AidCase.create({
      caseNo: await nextCaseNo(),
      category: row.category,
      beneficiaryName: row.beneficiaryName,
      guardianName: row.guardianName,
      mohalla: row.mohalla,
      description: row.description,
      estimatedAmount: row.totalPaid,
      approvedAmount: row.totalPaid,
      status: "completed",
      statusHistory: [
        { status: "requested", reason: "", changedBy: actor, changedAt: day },
        { status: "approved", reason: REGISTER_NOTE, approvedAmount: row.totalPaid, changedBy: actor, changedAt: day },
        { status: "completed", reason: REGISTER_NOTE, changedBy: actor, changedAt: day },
      ],
      showNameToMembers: row.showNameToMembers,
      lastUpdateAt: day,
      createdBy: actor,
      importedFromRegister: true,
      registerPaidAmount: row.totalPaid,
    });
    amount += row.totalPaid;
  }
  return { created: rows.length, amount };
}
