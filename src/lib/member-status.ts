import { monthKey, monthRange, type MonthKey } from "@/lib/dates";

// Member status rules. Pure, safe to import on the client, the server and in tests.

export const MEMBER_STATUSES = ["active", "left", "deceased", "exempt"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export type StatusChange = {
  status: MemberStatus;
  /** When the change took effect (midnight Pakistan time of the chosen day). */
  date: Date | string;
};

export type StatusTimeline = {
  status: MemberStatus;
  statusHistory?: readonly StatusChange[] | null;
};

/**
 * The member's status at a moment in time. Before the first recorded change a
 * member is active. A record with no history at all is taken at its current status.
 */
export function statusOn(member: StatusTimeline, at: Date | string | number): MemberStatus {
  const history = member.statusHistory ?? [];
  if (history.length === 0) return member.status;

  const time = new Date(at).getTime();
  let status: MemberStatus = "active";
  let latest = Number.NEGATIVE_INFINITY;
  for (const change of history) {
    const changedAt = new Date(change.date).getTime();
    if (changedAt <= time && changedAt >= latest) {
      status = change.status;
      latest = changedAt;
    }
  }
  return status;
}

/**
 * Whether a member gets a monthly bill for `month`. Bills start from the join
 * month, and a month is billed only if the member was active on its first day.
 * So a member who left on 15 October still owes October, but not November;
 * left, deceased and exempt members never get bills for later months.
 */
export function isBillableMonth(
  member: StatusTimeline & { joinDate: Date | string },
  month: MonthKey,
): boolean {
  if (month < monthKey(member.joinDate)) return false;
  return statusOn(member, monthRange(month).start) === "active";
}
