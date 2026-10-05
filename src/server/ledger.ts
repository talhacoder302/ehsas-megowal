import "server-only";
import { Types } from "mongoose";
import { buildLedger, type LedgerInput, type LedgerRow } from "@/lib/contributions";
import { currentMonth, monthRange, type MonthKey } from "@/lib/dates";
import { can, requireOwnMember } from "@/lib/permissions";
import { ContributionBill, Income, Member } from "@/models";

export type MemberLedger = {
  rows: LedgerRow[];
  /** Owed now: opening due plus unpaid bills up to the current month. */
  dueNow: number;
  totalPaid: number;
  /** The latest future month already paid for, if any. */
  advancePaidUntil: MonthKey | null;
  canWaive: boolean;
  canReceive: boolean;
};

/**
 * A member's contribution ledger: opening due, every bill and every payment
 * with a running balance. Staff, or the member themselves.
 */
export async function getMemberLedger(memberId: string): Promise<MemberLedger | null> {
  const me = await requireOwnMember(memberId);
  if (!Types.ObjectId.isValid(memberId)) return null;
  const member = await Member.findById(memberId).select("openingDue joinDate createdAt").lean();
  if (!member) return null;

  const [bills, incomes] = await Promise.all([
    ContributionBill.find({ memberId: member._id }).lean(),
    Income.find({ memberId: member._id }).sort({ date: 1, createdAt: 1 }).lean(),
  ]);

  // The opening due shrinks as it is paid, so add back what payments took off it.
  const openingPaid = incomes.filter((i) => !i.cancelled).reduce((sum, i) => sum + i.openingDuePaid, 0);
  const openingOriginal = member.openingDue + openingPaid;

  const entries: LedgerInput[] = [];
  if (openingOriginal > 0) {
    entries.push({ kind: "opening", id: "opening", date: member.joinDate.toISOString(), amount: openingOriginal });
  }
  const now = currentMonth();
  for (const b of bills) {
    // A future month with nothing paid (e.g. left behind by a cancelled advance) is not owed yet.
    if (b.month > now && b.paidAmount === 0 && b.status !== "waived") continue;
    entries.push({
      kind: "bill",
      id: b._id.toString(),
      date: monthRange(b.month).start.toISOString(),
      month: b.month,
      amount: b.amount,
      paidAmount: b.paidAmount,
      status: b.status,
      waivedReason: b.waivedReason,
    });
  }
  for (const i of incomes) {
    entries.push({
      kind: "payment",
      id: i._id.toString(),
      date: i.date.toISOString(),
      createdAt: (i.createdAt ?? i._id.getTimestamp()).toISOString(),
      amount: i.amount,
      receiptNumber: i.receiptNumber,
      monthsCovered: i.monthsCovered,
      openingDuePaid: i.openingDuePaid,
      cancelled: i.cancelled,
      cancelReason: i.cancelReason,
    });
  }

  const dueNow =
    member.openingDue +
    bills
      .filter((b) => (b.status === "unpaid" || b.status === "partial") && b.month <= now)
      .reduce((sum, b) => sum + b.amount - b.paidAmount, 0);
  const advancePaidUntil =
    bills
      .filter((b) => b.status === "paid" && b.month > now)
      .map((b) => b.month)
      .sort()
      .at(-1) ?? null;

  return {
    rows: buildLedger(entries),
    dueNow,
    totalPaid: incomes.filter((i) => !i.cancelled).reduce((sum, i) => sum + i.amount, 0),
    advancePaidUntil,
    canWaive: can(me.role, "bills.manage"),
    canReceive: can(me.role, "payments.record"),
  };
}
