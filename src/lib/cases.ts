// Aid case rules. Pure, safe to import on the client, the server and in tests.

export const CASE_CATEGORIES = ["wedding", "funeral", "medical", "education", "house_repair", "ration", "other"] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_STATUSES = ["requested", "verifying", "approved", "in_progress", "on_hold", "completed", "rejected"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Statuses of a case that still needs attention. */
export const OPEN_STATUSES = ["requested", "verifying", "approved", "in_progress", "on_hold"] as const satisfies readonly CaseStatus[];

export type CaseTab = "open" | "completed" | "rejected";

/** A case with no update for this many days is highlighted on the list. */
export const STALE_DAYS = 7;

export function isOpenStatus(status: CaseStatus): boolean {
  return (OPEN_STATUSES as readonly CaseStatus[]).includes(status);
}

export function caseTab(status: CaseStatus): CaseTab {
  if (status === "completed") return "completed";
  if (status === "rejected") return "rejected";
  return "open";
}

/** The normal path, one step at a time. */
const NEXT_STEP: Partial<Record<CaseStatus, CaseStatus>> = {
  requested: "verifying",
  verifying: "approved",
  approved: "in_progress",
  in_progress: "completed",
};

export type StatusChangeLike = { status: CaseStatus };

export type CaseStatusState = {
  status: CaseStatus;
  approvedAmount: number | null;
  /** Oldest first. */
  statusHistory: readonly StatusChangeLike[];
};

/** The status a case had before it was put on hold (null if unknown). */
export function statusBeforeHold(history: readonly StatusChangeLike[]): CaseStatus | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].status === "on_hold") {
      for (let j = i - 1; j >= 0; j -= 1) {
        if (history[j].status !== "on_hold") return history[j].status;
      }
      return null;
    }
  }
  return null;
}

/**
 * Where a case may go next:
 * requested → verifying → approved → in_progress → completed, and on hold or
 * rejected from any open state. A case on hold goes back to in_progress once
 * it has an approved amount; a case put on hold earlier resumes at the step it
 * stopped at, so holding a case can never skip the approval.
 */
export function allowedNextStatuses(state: CaseStatusState): CaseStatus[] {
  const { status } = state;
  if (!isOpenStatus(status)) return [];

  if (status === "on_hold") {
    const options: CaseStatus[] = [];
    const before = statusBeforeHold(state.statusHistory);
    if (state.approvedAmount !== null) options.push("in_progress");
    else if (before && before !== "in_progress" && isOpenStatus(before)) options.push(before);
    else options.push("requested");
    options.push("rejected");
    return options;
  }

  const next = NEXT_STEP[status];
  return [...(next ? [next] : []), "on_hold", "rejected"];
}

export function canMoveTo(state: CaseStatusState, target: CaseStatus): boolean {
  return allowedNextStatuses(state).includes(target);
}

// ---------------------------------------------------------------------------
// Updates and highlighting
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since a moment (0 for today or the future). */
export function daysSince(at: Date | string, now: Date | number = Date.now()): number {
  return Math.max(0, Math.floor((new Date(now).getTime() - new Date(at).getTime()) / DAY_MS));
}

/** An open case that has had no update for more than STALE_DAYS days. */
export function isStale(status: CaseStatus, lastUpdateAt: Date | string, now: Date | number = Date.now()): boolean {
  return isOpenStatus(status) && daysSince(lastUpdateAt, now) > STALE_DAYS;
}

/** On the list, cases on hold or without a recent update stand out. */
export function needsAttention(status: CaseStatus, lastUpdateAt: Date | string, now: Date | number = Date.now()): boolean {
  return status === "on_hold" || isStale(status, lastUpdateAt, now);
}

/** The latest reason written for a status change ("" if none). */
export function lastReason(history: readonly { reason: string }[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].reason.trim()) return history[i].reason;
  }
  return "";
}

/** (14, "C-") -> "C-0014" */
export function formatCaseNo(seq: number, prefix: string): string {
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** What is still to be paid: the approved amount (or the estimate before approval) minus what was paid. */
export function remainingAmount(input: { estimatedAmount: number; approvedAmount: number | null; paidAmount: number }): number {
  return Math.max(0, (input.approvedAmount ?? input.estimatedAmount) - input.paidAmount);
}

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export type PrivateCaseFields = {
  beneficiaryName: string | null;
  guardianName: string | null;
  contactMobile: string | null;
  mohalla: string | null;
  description: string | null;
};

/**
 * Removes everything that could identify the family. Mohalla and description
 * go too: in a small village either can point to the household. Call this in
 * the service (with canSeeBeneficiaryDetails) before data leaves the server.
 */
export function redactCase<T extends PrivateCaseFields>(item: T, canSeeDetails: boolean): T {
  if (canSeeDetails) return item;
  return { ...item, beneficiaryName: null, guardianName: null, contactMobile: null, mohalla: null, description: null };
}
