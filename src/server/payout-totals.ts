import "server-only";
import type { Types } from "mongoose";
import { COUNTED_APPROVAL_STATUSES } from "@/lib/payouts";
import { Disbursement } from "@/models";

export type CasePayouts = { paid: number; pending: number };

/**
 * Paid (counted) and pending disbursement totals per case. Internal: callers
 * check the session. Rejected disbursements are left out.
 */
export async function payoutsByCase(caseIds?: Types.ObjectId[]): Promise<Map<string, CasePayouts>> {
  const rows = await Disbursement.aggregate<{ _id: { caseId: Types.ObjectId; status: string }; total: number }>([
    { $match: { approvalStatus: { $in: [...COUNTED_APPROVAL_STATUSES, "pending"] }, ...(caseIds ? { caseId: { $in: caseIds } } : {}) } },
    { $group: { _id: { caseId: "$caseId", status: "$approvalStatus" }, total: { $sum: "$amount" } } },
  ]);
  const out = new Map<string, CasePayouts>();
  for (const row of rows) {
    const key = row._id.caseId.toString();
    const entry = out.get(key) ?? { paid: 0, pending: 0 };
    if (row._id.status === "pending") entry.pending += row.total;
    else entry.paid += row.total;
    out.set(key, entry);
  }
  return out;
}
