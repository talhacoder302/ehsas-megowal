import "server-only";
import { isBillableMonth, type MemberStatus } from "@/lib/member-status";
import { rateForMonth } from "@/lib/contributions";
import type { MonthKey } from "@/lib/dates";
import { requirePermission } from "@/lib/permissions";
import { monthKeySchema } from "@/lib/validators";
import { ContributionBill, Member } from "@/models";
import { billDuesByMember, loadRates } from "./contributions-core";

export type PendingRow = {
  memberId: string;
  memberNo: string;
  name: string;
  fatherName: string;
  mobile: string;
  mohalla: string;
  status: MemberStatus;
  openingDue: number;
  /** Unpaid months up to the selected month, oldest first. */
  months: { month: MonthKey; due: number }[];
  totalDue: number;
};

export type PendingReport = {
  month: MonthKey;
  /** Rate for the month, null if no rate covers it yet. */
  rate: number | null;
  /** Members who should have a bill this month. */
  billableCount: number;
  billCount: number;
  waivedCount: number;
  /** Sum of bill amounts for the month (waived bills left out). */
  billed: number;
  /** Paid so far against this month's bills. */
  collected: number;
  pending: number;
  /** Whole percent, null when nothing was billed. */
  percent: number | null;
  /** Members owing anything up to and including the month, most owed first. */
  rows: PendingRow[];
  totalDue: number;
};

export async function getPendingReport(input: unknown): Promise<PendingReport> {
  await requirePermission("payments.record");
  const month = monthKeySchema.parse(input);

  const [rates, bills, dues, members] = await Promise.all([
    loadRates(),
    ContributionBill.find({ month }).select("amount paidAmount status").lean(),
    billDuesByMember(month),
    Member.find().select("memberNo name fatherName mobile mohalla status statusHistory joinDate openingDue").lean(),
  ]);

  let billed = 0;
  let collected = 0;
  let waivedCount = 0;
  for (const b of bills) {
    if (b.status === "waived") {
      waivedCount += 1;
      continue;
    }
    billed += b.amount;
    collected += b.paidAmount;
  }

  const rows: PendingRow[] = [];
  for (const m of members) {
    const id = m._id.toString();
    const bill = dues.get(id);
    const totalDue = m.openingDue + (bill?.due ?? 0);
    if (totalDue <= 0) continue;
    rows.push({
      memberId: id,
      memberNo: m.memberNo,
      name: m.name,
      fatherName: m.fatherName,
      mobile: m.mobile,
      mohalla: m.mohalla,
      status: m.status,
      openingDue: m.openingDue,
      months: bill?.months ?? [],
      totalDue,
    });
  }
  rows.sort((a, b) => b.totalDue - a.totalDue || a.memberNo.localeCompare(b.memberNo, "en", { numeric: true }));

  return {
    month,
    rate: rateForMonth(rates, month),
    billableCount: members.filter((m) => isBillableMonth(m, month)).length,
    billCount: bills.length,
    waivedCount,
    billed,
    collected,
    pending: billed - collected,
    percent: billed > 0 ? Math.round((collected / billed) * 100) : null,
    rows,
    totalDue: rows.reduce((sum, r) => sum + r.totalDue, 0),
  };
}
