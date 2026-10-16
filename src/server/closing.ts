import "server-only";
import { Types } from "mongoose";
import { freeBalance, isMonthLocked, nextMonthToClose, type ClosingFigures, type CloseBlock } from "@/lib/closing";
import { compareMonths, currentMonth, isMonthKey, monthsBetween, shiftMonth, type MonthKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { monthKeySchema, reasonFormSchema } from "@/lib/validators";
import { Account, MonthClosing, User } from "@/models";
import { accountBalance, movementsByAccount, NO_MOVEMENTS } from "./account-totals";
import { logActivity } from "./activity-log";
import {
  closeBlockFor,
  closeMonthCore,
  committedAt,
  computeMonthFigures,
  booksStartMonth,
  lockedThrough,
  pendingApprovalsThrough,
  type AccountBalanceAt,
} from "./closing-core";
import { readSettings } from "./settings";

export type MonthOption = { month: MonthKey; state: "closed" | "reopened" | "open" };

export type ReopeningItem = { reason: string; byName: string; at: string; closingBalance: number };

export type ClosingView = {
  month: MonthKey;
  /** Months that can be looked at, newest first. */
  months: MonthOption[];
  closed: boolean;
  figures: ClosingFigures;
  accountBalances: AccountBalanceAt[];
  /** Live figures only: where the opening balance came from. */
  openingFrom: "previousClosing" | "accounts" | null;
  closedByName: string | null;
  closedAt: string | null;
  /** Why the month cannot be closed now (null when it can, or is closed). */
  block: CloseBlock | null;
  /** The month that has to be closed first. */
  nextToClose: MonthKey;
  pendingApprovals: number;
  /** The viewer is the admin and this is the latest closed month. */
  canReopen: boolean;
  reopenings: ReopeningItem[];
};

async function userNames(ids: (Types.ObjectId | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

/**
 * The closing screen for one month (default: the next month to close, or last
 * month). Closed months show the saved figures; open months show them live.
 */
export async function getClosingView(requested?: string): Promise<ClosingView> {
  const me = await requirePermission("months.close");
  const current = currentMonth();
  const [locked, first, closings] = await Promise.all([
    lockedThrough(),
    booksStartMonth(),
    MonthClosing.find().select("month status").sort({ month: 1 }).lean(),
  ]);
  const nextToClose = nextMonthToClose({ lockedThrough: locked, firstEntryMonth: first, current });

  const starts = [first, closings[0]?.month, shiftMonth(current, -1)].filter((m): m is MonthKey => Boolean(m));
  const oldest = starts.reduce((a, b) => (compareMonths(a, b) <= 0 ? a : b));
  const stateOf = new Map(closings.map((c) => [c.month, c.status]));
  const months: MonthOption[] = monthsBetween(oldest, current)
    .reverse()
    .map((m) => ({ month: m, state: stateOf.get(m) ?? "open" }));

  const fallback = compareMonths(nextToClose, current) < 0 ? nextToClose : (locked ?? shiftMonth(current, -1));
  const month = requested && isMonthKey(requested) && months.some((m) => m.month === requested) ? requested : fallback;

  const doc = await MonthClosing.findOne({ month }).lean();
  const closed = doc?.status === "closed";
  const names = await userNames([doc?.closedBy, ...(doc?.reopenings ?? []).map((r) => r.reopenedBy)]);
  const reopenings = (doc?.reopenings ?? [])
    .map((r) => ({ reason: r.reason, byName: names.get(r.reopenedBy.toString()) ?? "", at: r.reopenedAt.toISOString(), closingBalance: r.closingBalance }))
    .reverse();

  if (doc && closed) {
    return {
      month,
      months,
      closed: true,
      figures: {
        openingBalance: doc.openingBalance,
        totalIncome: doc.totalIncome,
        totalDisbursed: doc.totalDisbursed,
        totalExpenses: doc.totalExpenses,
        closingBalance: doc.closingBalance,
        committedAmount: doc.committedAmount,
        emergencyReserve: doc.emergencyReserve,
        freeBalance: doc.freeBalance,
      },
      accountBalances: doc.accountBalances.map((a) => ({ accountId: a.accountId.toString(), name: a.name, balance: a.balance })),
      openingFrom: null,
      closedByName: doc.closedBy ? (names.get(doc.closedBy.toString()) ?? null) : null,
      closedAt: doc.closedAt.toISOString(),
      block: "alreadyClosed",
      nextToClose,
      pendingApprovals: 0,
      canReopen: me.role === "admin" && locked === month,
      reopenings,
    };
  }

  const [live, block, pendingApprovals] = await Promise.all([computeMonthFigures(month), closeBlockFor(month), pendingApprovalsThrough(month)]);
  return {
    month,
    months,
    closed: false,
    figures: live.figures,
    accountBalances: live.accountBalances,
    openingFrom: live.openingFrom,
    closedByName: null,
    closedAt: null,
    block,
    nextToClose,
    pendingApprovals,
    canReopen: false,
    reopenings,
  };
}

/** Heads and admin: save the month's figures and lock it. */
export async function closeMonth(input: unknown): Promise<void> {
  const actor = await requirePermission("months.close");
  const month = monthKeySchema.parse(input);
  const doc = await closeMonthCore(month, actor.id);
  await logActivity({
    actorId: actor.id,
    action: "month.closed",
    entity: "MonthClosing",
    entityId: doc._id,
    meta: { month, closingBalance: doc.closingBalance, committedAmount: doc.committedAmount, freeBalance: doc.freeBalance },
  });
}

/**
 * Admin only: unlock the latest closed month so entries can be fixed. The old
 * figures are kept on the document with the reason.
 */
export async function reopenMonth(monthInput: unknown, input: unknown): Promise<void> {
  const actor = await requirePermission("months.reopen");
  const month = monthKeySchema.parse(monthInput);
  const { reason } = reasonFormSchema.parse(input);

  const locked = await lockedThrough();
  if (!isMonthLocked(month, locked)) throw new AppError("monthNotClosed");
  if (locked !== month) throw new AppError("reopenLatestOnly");

  const doc = await MonthClosing.findOne({ month, status: "closed" }).lean();
  if (!doc) throw new AppError("monthNotClosed");
  const result = await MonthClosing.updateOne(
    { _id: doc._id, status: "closed" },
    {
      $set: { status: "reopened" },
      $push: {
        reopenings: {
          reason,
          reopenedBy: new Types.ObjectId(actor.id),
          reopenedAt: new Date(),
          closedBy: doc.closedBy ?? null,
          closedAt: doc.closedAt,
          closingBalance: doc.closingBalance,
          freeBalance: doc.freeBalance,
        },
      },
    },
  );
  if (result.modifiedCount === 0) throw new AppError("monthNotClosed");

  await logActivity({
    actorId: actor.id,
    action: "month.reopened",
    entity: "MonthClosing",
    entityId: doc._id,
    meta: { month, reason, closingBalance: doc.closingBalance },
  });
}

export type Budget = {
  /** Money in all accounts now. */
  balance: number;
  committed: number;
  reserve: number;
  free: number;
  /** A month that has ended and still waits to be closed, or null. */
  monthToClose: MonthKey | null;
};

/** The dashboard budget card: what the fund holds and how much is free to promise. */
export async function getBudget(): Promise<Budget> {
  await requirePermission("accounts.manage");
  const now = new Date();
  const [accounts, movements, committed, settings, locked, first] = await Promise.all([
    Account.find().select("openingBalance").lean(),
    movementsByAccount(),
    committedAt(now),
    readSettings(),
    lockedThrough(),
    booksStartMonth(),
  ]);
  const balance = accounts.reduce(
    (sum, a) =>
      sum +
      accountBalance({
        openingBalance: a.openingBalance,
        ...(movements.get(a._id.toString()) ?? NO_MOVEMENTS),
      }),
    0,
  );
  const current = currentMonth();
  const next = nextMonthToClose({ lockedThrough: locked, firstEntryMonth: first, current });
  return {
    balance,
    committed,
    reserve: settings.emergencyReserve,
    free: freeBalance({ balance, committed, reserve: settings.emergencyReserve }),
    monthToClose: first && compareMonths(next, current) < 0 ? next : null,
  };
}
