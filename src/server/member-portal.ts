import "server-only";
import { Types } from "mongoose";
import { NOT_FROM_REGISTER } from "@/lib/contributions";
import { currentMonth, monthsBetween, type MonthKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { requireOwnMember, requireUser } from "@/lib/permissions";
import { ContributionBill, Income, Member } from "@/models";
import { billDuesByMember } from "./contributions-core";

export type MemberHome = {
  name: string;
  memberNo: string;
  /** Owed now: opening due plus unpaid bills up to the current month. */
  dueNow: number;
  year: string;
  /** January to the current month: paid in full, owed (unpaid or part paid), or not billed / waived. */
  yearMonths: { month: MonthKey; state: "paid" | "due" | "none" }[];
  monthsPaidThisYear: number;
  /** Months of this year billed so far (waived ones left out). */
  monthsBilledThisYear: number;
  latestReceipt: {
    receiptNumber: string;
    date: string;
    amount: number;
    publicToken: string;
    monthsCovered: MonthKey[];
    openingDuePaid: number;
  } | null;
};

/** The signed-in user's own member id. Staff without a member record have none. */
async function myMemberId(): Promise<string> {
  const me = await requireUser();
  if (!me.memberId) throw new AppError("forbidden");
  await requireOwnMember(me.memberId, { staffAllowed: false });
  return me.memberId;
}

/** Home screen of the member portal: only ever the signed-in member's own data. */
export async function getMemberHome(): Promise<MemberHome> {
  const memberId = await myMemberId();
  const now = currentMonth();
  const year = now.slice(0, 4);

  const [member, dues, bills, latest] = await Promise.all([
    Member.findById(memberId).select("name memberNo openingDue").lean(),
    billDuesByMember(now, new Types.ObjectId(memberId)),
    ContributionBill.find({ memberId, month: { $gte: `${year}-01`, $lte: now } }).select("month status").sort({ month: 1 }).lean(),
    Income.findOne({ memberId, cancelled: false, ...NOT_FROM_REGISTER }).sort({ date: -1, createdAt: -1 }).lean(),
  ]);
  if (!member) throw new AppError("memberNotFound");

  return {
    name: member.name,
    memberNo: member.memberNo,
    dueNow: member.openingDue + (dues.get(memberId)?.due ?? 0),
    year,
    yearMonths: monthsBetween(`${year}-01`, now).map((month) => {
      const status = bills.find((b) => b.month === month)?.status;
      return { month, state: status === "paid" ? "paid" : status === "unpaid" || status === "partial" ? "due" : "none" };
    }),
    monthsPaidThisYear: bills.filter((b) => b.status === "paid").length,
    monthsBilledThisYear: bills.filter((b) => b.status !== "waived").length,
    latestReceipt: latest
      ? {
          receiptNumber: latest.receiptNumber,
          date: latest.date.toISOString(),
          amount: latest.amount,
          publicToken: latest.publicToken,
          monthsCovered: latest.monthsCovered,
          openingDuePaid: latest.openingDuePaid,
        }
      : null,
  };
}

/** For the member portal pages: the signed-in member's id (throws for staff without one). */
export async function requireMyMemberId(): Promise<string> {
  return myMemberId();
}
