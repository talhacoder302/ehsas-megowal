import { isOpenStatus, type CaseStatus } from "@/lib/cases";
import { compareMonths, shiftMonth, type MonthKey } from "@/lib/dates";

// Rules for keeping the books: month closing, locked months, the budget and
// cash counts. Pure, safe to import on the client, the server and in tests.

export const CLOSING_STATUSES = ["closed", "reopened"] as const;
export type ClosingStatus = (typeof CLOSING_STATUSES)[number];

/** The numbers saved when a month is closed, in whole rupees. */
export type ClosingFigures = {
  openingBalance: number;
  totalIncome: number;
  /** Approved aid payments only (pending and rejected left out). */
  totalDisbursed: number;
  totalExpenses: number;
  closingBalance: number;
  /** Approved but not yet paid on open cases, at month end. */
  committedAmount: number;
  emergencyReserve: number;
  /** closingBalance − committedAmount − emergencyReserve. Can be below zero. */
  freeBalance: number;
};

export function closingBalance(t: { openingBalance: number; totalIncome: number; totalDisbursed: number; totalExpenses: number }): number {
  return t.openingBalance + t.totalIncome - t.totalDisbursed - t.totalExpenses;
}

/** Money that may still be promised to new cases. */
export function freeBalance(t: { balance: number; committed: number; reserve: number }): number {
  return t.balance - t.committed - t.reserve;
}

export function buildClosingFigures(input: {
  openingBalance: number;
  totalIncome: number;
  totalDisbursed: number;
  totalExpenses: number;
  committedAmount: number;
  emergencyReserve: number;
}): ClosingFigures {
  const closing = closingBalance(input);
  return {
    ...input,
    closingBalance: closing,
    freeBalance: freeBalance({ balance: closing, committed: input.committedAmount, reserve: input.emergencyReserve }),
  };
}

// ---------------------------------------------------------------------------
// Locked months
// ---------------------------------------------------------------------------

/**
 * Closed months always form one run up to `lockedThrough` (months close in
 * order and only the latest can be reopened), so a month is locked when it is
 * on or before that month.
 */
export function isMonthLocked(month: MonthKey, lockedThrough: MonthKey | null): boolean {
  return lockedThrough !== null && compareMonths(month, lockedThrough) <= 0;
}

/**
 * The only month that may be closed next: the month after the latest closed
 * one, or (before any closing) the first month that has an entry. With no
 * entries at all it is last month.
 */
export function nextMonthToClose(input: { lockedThrough: MonthKey | null; firstEntryMonth: MonthKey | null; current: MonthKey }): MonthKey {
  if (input.lockedThrough) return shiftMonth(input.lockedThrough, 1);
  return input.firstEntryMonth ?? shiftMonth(input.current, -1);
}

export type CloseBlock = "alreadyClosed" | "notEnded" | "closePreviousFirst" | "pendingApprovals";

/** Why `month` cannot be closed now, or null if it can. */
export function closeBlock(
  month: MonthKey,
  input: { lockedThrough: MonthKey | null; firstEntryMonth: MonthKey | null; current: MonthKey; pendingApprovals: number },
): CloseBlock | null {
  if (isMonthLocked(month, input.lockedThrough)) return "alreadyClosed";
  if (compareMonths(month, input.current) >= 0) return "notEnded";
  if (month !== nextMonthToClose(input)) return "closePreviousFirst";
  if (input.pendingApprovals > 0) return "pendingApprovals";
  return null;
}

// ---------------------------------------------------------------------------
// Committed money on aid cases
// ---------------------------------------------------------------------------

export type CaseHistoryRow = { status: CaseStatus; approvedAmount: number | null; changedAt: Date | string };

/**
 * Status and approved amount of a case just before `asOf`, read from its
 * history (oldest first). null if the case did not exist yet.
 */
export function caseStateAt(history: readonly CaseHistoryRow[], asOf: Date): { status: CaseStatus; approvedAmount: number | null } | null {
  const before = history.filter((row) => new Date(row.changedAt).getTime() < asOf.getTime());
  if (before.length === 0) return null;
  // Rows that do not change the approved amount carry null; the last amount set still holds.
  const approved = before.findLast((row) => row.approvedAmount !== null);
  return { status: before[before.length - 1].status, approvedAmount: approved?.approvedAmount ?? null };
}

/**
 * Approved but unpaid money on cases that were open at `asOf`. `paid` is what
 * had been paid out on the case by then (approved payments only).
 */
export function committedAmount(cases: readonly { history: readonly CaseHistoryRow[]; paid: number }[], asOf: Date): number {
  let total = 0;
  for (const c of cases) {
    const state = caseStateAt(c.history, asOf);
    if (!state || !isOpenStatus(state.status) || state.approvedAmount === null) continue;
    total += Math.max(0, state.approvedAmount - c.paid);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Cash counts
// ---------------------------------------------------------------------------

/** Counted minus system: below zero is money missing, above zero is extra. */
export function countDifference(systemBalance: number, countedAmount: number): number {
  return countedAmount - systemBalance;
}
