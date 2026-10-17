import "server-only";
import type { Types } from "mongoose";
import { daysSince, lastReason, needsAttention, OPEN_STATUSES, type CaseCategory, type CaseStatus } from "@/lib/cases";
import { rateForMonth } from "@/lib/contributions";
import { currentMonth, type MonthKey } from "@/lib/dates";
import { can, requirePermission } from "@/lib/permissions";
import { ActivityLog, AidCase, User } from "@/models";
import { loadRates } from "./contributions-core";
import { getPendingReport } from "./pending";

export type DashboardCollection = {
  month: MonthKey;
  /** What this month's bills ask for; before bills are made, members billable × the rate. */
  expected: number;
  /** Paid so far against this month's bills. */
  collected: number;
  percent: number | null;
  billsGenerated: boolean;
  /** Members owing anything up to this month, and how much in all. */
  pendingMembers: number;
  pendingAmount: number;
};

export type AttentionCase = {
  id: string;
  caseNo: string;
  category: CaseCategory;
  status: CaseStatus;
  beneficiaryName: string;
  lastReason: string;
  daysSinceUpdate: number;
};

export type DashboardCases = {
  /** Open cases per status (statuses with none are 0). */
  byStatus: Record<(typeof OPEN_STATUSES)[number], number>;
  open: number;
  /** On hold, or no update for STALE_DAYS days or more; the longest waiting first (at most 5). */
  attention: AttentionCase[];
  attentionCount: number;
};

export type ActivityEntry = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  /** Short facts pulled from the log row, shown after the action. */
  caseNo: string | null;
  receiptNumber: string | null;
  month: MonthKey | null;
  amount: number | null;
  name: string | null;
};

export type Dashboard = {
  collection: DashboardCollection;
  cases: DashboardCases;
  /** null when the viewer may not see the activity log. */
  activity: ActivityEntry[] | null;
};

const ATTENTION_LIMIT = 5;
const ACTIVITY_LIMIT = 5;

async function collection(): Promise<DashboardCollection> {
  const month = currentMonth();
  const [report, rates] = await Promise.all([getPendingReport(month), loadRates()]);
  const generated = report.billCount > 0;
  const expected = generated ? report.billed : report.billableCount * (rateForMonth(rates, month) ?? 0);
  return {
    month,
    expected,
    collected: report.collected,
    percent: expected > 0 ? Math.round((report.collected / expected) * 100) : null,
    billsGenerated: generated,
    pendingMembers: report.rows.length,
    pendingAmount: report.totalDue,
  };
}

async function cases(): Promise<DashboardCases> {
  const open = await AidCase.find({ status: { $in: [...OPEN_STATUSES] } })
    .select("caseNo category status beneficiaryName statusHistory lastUpdateAt")
    .lean();
  const byStatus = Object.fromEntries(OPEN_STATUSES.map((s) => [s, open.filter((c) => c.status === s).length])) as DashboardCases["byStatus"];
  const now = Date.now();
  const flagged = open
    .filter((c) => needsAttention(c.status, c.lastUpdateAt, now))
    .sort((a, b) => a.lastUpdateAt.getTime() - b.lastUpdateAt.getTime());
  return {
    byStatus,
    open: open.length,
    attentionCount: flagged.length,
    attention: flagged.slice(0, ATTENTION_LIMIT).map((c) => ({
      id: c._id.toString(),
      caseNo: c.caseNo,
      category: c.category,
      status: c.status,
      beneficiaryName: c.beneficiaryName,
      lastReason: lastReason(c.statusHistory),
      daysSinceUpdate: daysSince(c.lastUpdateAt, now),
    })),
  };
}

const text = (value: unknown) => (typeof value === "string" && value ? value : null);

async function recentActivity(): Promise<ActivityEntry[]> {
  const rows = await ActivityLog.find().sort({ createdAt: -1 }).limit(ACTIVITY_LIMIT).lean();
  const actorIds = [...new Set(rows.map((r) => r.actorId?.toString()).filter((id): id is string => Boolean(id)))];
  const users = actorIds.length ? await User.find({ _id: { $in: actorIds } }).select("name").lean() : [];
  const names = new Map(users.map((u) => [(u._id as Types.ObjectId).toString(), u.name]));
  return rows.map((r) => {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    return {
      id: r._id.toString(),
      action: r.action,
      actorName: r.actorId ? (names.get(r.actorId.toString()) ?? null) : null,
      createdAt: (r.createdAt ?? r._id.getTimestamp()).toISOString(),
      caseNo: text(meta.caseNo),
      receiptNumber: text(meta.receiptNumber),
      month: text(meta.month),
      amount: typeof meta.amount === "number" ? meta.amount : null,
      name: text(meta.name),
    };
  });
}

/** Everything on the manage dashboard except the budget and approvals (they have their own services). */
export async function getDashboard(): Promise<Dashboard> {
  const me = await requirePermission("payments.record");
  const [collectionData, casesData, activity] = await Promise.all([
    collection(),
    cases(),
    can(me.role, "activity.view") ? recentActivity() : Promise.resolve(null),
  ]);
  return { collection: collectionData, cases: casesData, activity };
}
