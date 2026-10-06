import type { Role } from "@/lib/roles";

// Rules for money going out: aid disbursements, expenses and transfers.
// Pure, safe to import on the client, the server and in tests.

export const APPROVAL_STATUSES = ["not_required", "pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Disbursements that have left the account. Pending and rejected ones have not. */
export const COUNTED_APPROVAL_STATUSES = ["not_required", "approved"] as const satisfies readonly ApprovalStatus[];

export function disbursementCounts(status: ApprovalStatus): boolean {
  return (COUNTED_APPROVAL_STATUSES as readonly ApprovalStatus[]).includes(status);
}

export const EXPENSE_CATEGORIES = ["stationery", "printing", "transport", "bank_charges", "refreshments", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Case statuses in which money may be paid out. */
export const PAYABLE_CASE_STATUSES = ["approved", "in_progress"] as const;

export type ApprovalSettings = { enabled: boolean; limit: number };

/** Whether a disbursement must wait for a second head. */
export function needsSecondApproval(settings: ApprovalSettings, amount: number): boolean {
  return settings.enabled && amount > settings.limit;
}

/**
 * A pending disbursement may be approved (or rejected) by a head or the
 * admin, but never by the person who entered it.
 */
export function canApproveDisbursement(
  actor: { id: string; role: Role },
  disbursement: { paidBy: string; approvalStatus: ApprovalStatus },
): boolean {
  if (disbursement.approvalStatus !== "pending") return false;
  if (actor.role !== "head" && actor.role !== "admin") return false;
  return actor.id !== disbursement.paidBy;
}

export type CasePayoutState = {
  approvedAmount: number | null;
  /** Paid and counted (not_required + approved). */
  paid: number;
  /** Waiting for a second head. Counts against the approved amount too. */
  pending: number;
};

/** What may still be paid on a case: approved amount minus paid and pending. */
export function payableLeft(state: CasePayoutState): number {
  return Math.max(0, (state.approvedAmount ?? 0) - state.paid - state.pending);
}

/** A new payment of `amount` would go over the approved amount. */
export function exceedsApproved(state: CasePayoutState, amount: number): boolean {
  return amount > payableLeft(state);
}

/** Everything approved has been paid (pending payments not included). */
export function isFullyPaid(state: Pick<CasePayoutState, "approvedAmount" | "paid">): boolean {
  return state.approvedAmount !== null && state.approvedAmount > 0 && state.paid >= state.approvedAmount;
}
