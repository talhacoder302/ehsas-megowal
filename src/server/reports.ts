import "server-only";
import { Types } from "mongoose";
import { NOT_FROM_REGISTER } from "@/lib/contributions";
import { lastReason, OPEN_STATUSES, type CaseCategory, type CaseStatus } from "@/lib/cases";
import type { ClosingFigures } from "@/lib/closing";
import { compareMonths, currentMonth, isMonthKey, monthRange, shiftMonth, TIME_ZONE, type MonthKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { isBillableMonth } from "@/lib/member-status";
import { COUNTED_APPROVAL_STATUSES } from "@/lib/payouts";
import { requirePermission } from "@/lib/permissions";
import {
  collectionCounts,
  groupAid,
  groupExpenses,
  lastMonths,
  reportMonths,
  reportVersionFor,
  showsBeneficiary,
  type ReportAidGroup,
  type ReportExpenseGroup,
  type ReportVersion,
} from "@/lib/reports";
import { AidCase, ContributionBill, Disbursement, Expense, Income, Member, MonthClosing } from "@/models";
import { booksStartMonth, computeMonthFigures, lockedThrough } from "./closing-core";
import { payoutsByCase } from "./payout-totals";
import { readSettings } from "./settings";

export type ReportOpenCase = {
  caseNo: string;
  category: CaseCategory;
  status: CaseStatus;
  /** null unless the version may show it. */
  beneficiaryName: string | null;
  approvedAmount: number | null;
  paidAmount: number;
  lastReason: string;
  lastUpdateAt: string;
};

export type MonthlyReport = {
  month: MonthKey;
  version: ReportVersion;
  programName: string;
  villageName: string;
  /** Closed months show the saved figures; open months are live and may change. */
  closed: boolean;
  closedAt: string | null;
  figures: ClosingFigures;
  collection: { activeMembers: number; paidMembers: number; amount: number; payments: number };
  aid: { total: number; groups: ReportAidGroup[] };
  expenses: { total: number; groups: ReportExpenseGroup[] };
  /** Cases open now, with their current status and last reason. */
  openCases: ReportOpenCase[];
  generatedAt: string;
};

export type ChartPoint = { month: MonthKey; collection: number; aid: number };

/** The month that a report opens on when none is asked for: the latest closed month, else last month. */
async function defaultReportMonth(months: MonthKey[]): Promise<MonthKey> {
  const locked = await lockedThrough();
  if (locked && months.includes(locked)) return locked;
  const last = shiftMonth(currentMonth(), -1);
  return months.includes(last) ? last : months[0];
}

/** Months with a report (newest first) and the month to show. */
export async function resolveReportMonth(requested: unknown): Promise<{ month: MonthKey; months: MonthKey[] }> {
  await requirePermission("reports.view");
  const months = reportMonths(await booksStartMonth(), currentMonth());
  const month = isMonthKey(requested) && months.includes(requested) ? requested : await defaultReportMonth(months);
  return { month, months };
}

/**
 * The monthly report. Members always get the members version: beneficiary
 * names only where showNameToMembers is on. Staff choose the version.
 */
export async function getMonthlyReport(monthInput: unknown, requestedVersion?: unknown): Promise<MonthlyReport> {
  const me = await requirePermission("reports.view");
  if (!isMonthKey(monthInput)) throw new AppError("invalidInput");
  const month = monthInput;
  if (compareMonths(month, currentMonth()) > 0) throw new AppError("monthInFuture");
  const version = reportVersionFor(me.role, requestedVersion);
  const { start, end } = monthRange(month);
  const inMonth = { $gte: start, $lt: end };

  const [settings, closing, members, bills, incomes, disbursements, expenses, openCases, payouts] = await Promise.all([
    readSettings(),
    MonthClosing.findOne({ month, status: "closed" }).lean(),
    Member.find().select("joinDate status statusHistory").lean(),
    ContributionBill.find({ month }).select("memberId status").lean(),
    Income.find({ date: inMonth, cancelled: false, ...NOT_FROM_REGISTER }).select("amount").lean(),
    Disbursement.find({ date: inMonth, approvalStatus: { $in: [...COUNTED_APPROVAL_STATUSES] } }).select("caseId amount").lean(),
    Expense.find({ date: inMonth }).select("category amount").lean(),
    AidCase.find({ status: { $in: [...OPEN_STATUSES] } })
      .select("caseNo category status beneficiaryName showNameToMembers approvedAmount statusHistory lastUpdateAt")
      .sort({ caseNo: 1 })
      .lean(),
    payoutsByCase(),
  ]);

  const figures: ClosingFigures = closing
    ? {
        openingBalance: closing.openingBalance,
        totalIncome: closing.totalIncome,
        totalDisbursed: closing.totalDisbursed,
        totalExpenses: closing.totalExpenses,
        closingBalance: closing.closingBalance,
        committedAmount: closing.committedAmount,
        emergencyReserve: closing.emergencyReserve,
        freeBalance: closing.freeBalance,
      }
    : (await computeMonthFigures(month)).figures;

  const paidBills = new Set(bills.filter((b) => b.status === "paid").map((b) => b.memberId.toString()));
  const counts = collectionCounts(
    members.map((m) => ({ billable: isBillableMonth(m, month), paid: paidBills.has(m._id.toString()) })),
  );

  const aidCaseIds = [...new Set(disbursements.map((d) => d.caseId.toString()))].map((id) => new Types.ObjectId(id));
  const aidCases = aidCaseIds.length
    ? await AidCase.find({ _id: { $in: aidCaseIds } }).select("caseNo category beneficiaryName showNameToMembers").lean()
    : [];
  const caseById = new Map(aidCases.map((c) => [c._id.toString(), c]));
  const aidGroups = groupAid(
    disbursements.flatMap((d) => {
      const c = caseById.get(d.caseId.toString());
      if (!c) return [];
      return [{ caseId: c._id.toString(), caseNo: c.caseNo, category: c.category, beneficiaryName: showsBeneficiary(version, c) ? c.beneficiaryName : null, amount: d.amount }];
    }),
  );
  const expenseGroups = groupExpenses(expenses);

  return {
    month,
    version,
    programName: settings.programName,
    villageName: settings.villageName,
    closed: Boolean(closing),
    closedAt: closing ? closing.closedAt.toISOString() : null,
    figures,
    collection: { ...counts, amount: incomes.reduce((sum, i) => sum + i.amount, 0), payments: incomes.length },
    aid: { total: aidGroups.reduce((sum, g) => sum + g.total, 0), groups: aidGroups },
    expenses: { total: expenseGroups.reduce((sum, g) => sum + g.total, 0), groups: expenseGroups },
    openCases: openCases.map((c) => ({
      caseNo: c.caseNo,
      category: c.category,
      status: c.status,
      beneficiaryName: showsBeneficiary(version, c) ? c.beneficiaryName : null,
      approvedAmount: c.approvedAmount ?? null,
      paidAmount: payouts.get(c._id.toString())?.paid ?? 0,
      lastReason: lastReason(c.statusHistory),
      lastUpdateAt: c.lastUpdateAt.toISOString(),
    })),
    generatedAt: new Date().toISOString(),
  };
}

/** Collection and aid given per month for the `count` months ending with `end` (chart). */
export async function getCollectionVsAid(end: MonthKey = currentMonth(), count = 12): Promise<ChartPoint[]> {
  await requirePermission("reports.view");
  const months = lastMonths(end, count);
  const range = { $gte: monthRange(months[0]).start, $lt: monthRange(end).end };
  const byMonth = { $dateToString: { format: "%Y-%m", date: "$date", timezone: TIME_ZONE } };
  const [income, aid] = await Promise.all([
    Income.aggregate<{ _id: MonthKey; total: number }>([
      { $match: { cancelled: false, ...NOT_FROM_REGISTER, date: range } },
      { $group: { _id: byMonth, total: { $sum: "$amount" } } },
    ]),
    Disbursement.aggregate<{ _id: MonthKey; total: number }>([
      { $match: { approvalStatus: { $in: [...COUNTED_APPROVAL_STATUSES] }, date: range } },
      { $group: { _id: byMonth, total: { $sum: "$amount" } } },
    ]),
  ]);
  const incomeBy = new Map(income.map((r) => [r._id, r.total]));
  const aidBy = new Map(aid.map((r) => [r._id, r.total]));
  return months.map((month) => ({ month, collection: incomeBy.get(month) ?? 0, aid: aidBy.get(month) ?? 0 }));
}
