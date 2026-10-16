import { CASE_CATEGORIES, type CaseCategory } from "@/lib/cases";
import { compareMonths, shiftMonth, type MonthKey } from "@/lib/dates";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/payouts";
import { isStaff, type Role } from "@/lib/roles";

// Rules for the monthly report. Pure, safe to import on the client, the
// server and in tests.

/** "heads": full details. "members": beneficiary names only where the family agreed. */
export const REPORT_VERSIONS = ["heads", "members"] as const;
export type ReportVersion = (typeof REPORT_VERSIONS)[number];

export function isReportVersion(value: unknown): value is ReportVersion {
  return typeof value === "string" && (REPORT_VERSIONS as readonly string[]).includes(value);
}

/** Members can only ever get the members version; staff get what they ask for (heads by default). */
export function reportVersionFor(role: Role, requested: unknown): ReportVersion {
  if (!isStaff(role)) return "members";
  return isReportVersion(requested) ? requested : "heads";
}

/** Whether a version may show who a case is for. */
export function showsBeneficiary(version: ReportVersion, aidCase: { showNameToMembers: boolean }): boolean {
  return version === "heads" || aidCase.showNameToMembers;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export type AidPayment = { caseId: string; caseNo: string; category: CaseCategory; beneficiaryName: string | null; amount: number };
export type ReportAidCase = { caseNo: string; beneficiaryName: string | null; amount: number };
export type ReportAidGroup = { category: CaseCategory; total: number; cases: ReportAidCase[] };

/** Aid paid in the month by category (in the usual category order), one line per case. */
export function groupAid(payments: readonly AidPayment[]): ReportAidGroup[] {
  const byCase = new Map<string, AidPayment>();
  for (const p of payments) {
    const seen = byCase.get(p.caseId);
    byCase.set(p.caseId, seen ? { ...seen, amount: seen.amount + p.amount } : { ...p });
  }
  return CASE_CATEGORIES.flatMap((category) => {
    const cases = [...byCase.values()]
      .filter((c) => c.category === category)
      .sort((a, b) => a.caseNo.localeCompare(b.caseNo))
      .map((c) => ({ caseNo: c.caseNo, beneficiaryName: c.beneficiaryName, amount: c.amount }));
    if (cases.length === 0) return [];
    return [{ category, total: cases.reduce((sum, c) => sum + c.amount, 0), cases }];
  });
}

export type ReportExpenseGroup = { category: ExpenseCategory; total: number; count: number };

export function groupExpenses(expenses: readonly { category: ExpenseCategory; amount: number }[]): ReportExpenseGroup[] {
  return EXPENSE_CATEGORIES.flatMap((category) => {
    const rows = expenses.filter((e) => e.category === category);
    return rows.length ? [{ category, total: rows.reduce((sum, e) => sum + e.amount, 0), count: rows.length }] : [];
  });
}

/** Of the members billed for the month, how many have paid it in full. */
export function collectionCounts(members: readonly { billable: boolean; paid: boolean }[]): { activeMembers: number; paidMembers: number } {
  const billable = members.filter((m) => m.billable);
  return { activeMembers: billable.length, paidMembers: billable.filter((m) => m.paid).length };
}

// ---------------------------------------------------------------------------
// Months
// ---------------------------------------------------------------------------

/** Months a report can be made for, newest first: from the first month with entries to `current`. */
export function reportMonths(first: MonthKey | null, current: MonthKey): MonthKey[] {
  const start = first && compareMonths(first, current) <= 0 ? first : current;
  const months: MonthKey[] = [];
  for (let m = current; compareMonths(m, start) >= 0; m = shiftMonth(m, -1)) months.push(m);
  return months;
}

/** The `count` months ending with `end`, oldest first (for the chart). */
export function lastMonths(end: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(end, i - count + 1));
}
