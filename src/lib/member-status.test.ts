import { describe, expect, it } from "vitest";
import { parseDateKey } from "./dates";
import { isBillableMonth, statusOn, type StatusChange } from "./member-status";

function day(key: string): Date {
  const date = parseDateKey(key);
  if (!date) throw new Error(key);
  return date;
}

const joined = day("2024-01-01");

describe("statusOn", () => {
  it("is active before any recorded change", () => {
    const member = { status: "left" as const, statusHistory: [{ status: "left" as const, date: day("2025-06-10") }] };
    expect(statusOn(member, day("2025-06-09"))).toBe("active");
    expect(statusOn(member, day("2025-06-10"))).toBe("left");
    expect(statusOn(member, day("2026-01-01"))).toBe("left");
  });

  it("follows a member who left and came back", () => {
    const history: StatusChange[] = [
      { status: "left", date: day("2025-03-15") },
      { status: "active", date: day("2025-09-01") },
    ];
    const member = { status: "active" as const, statusHistory: history };
    expect(statusOn(member, day("2025-04-01"))).toBe("left");
    expect(statusOn(member, day("2025-09-01"))).toBe("active");
  });

  it("uses the current status when there is no history", () => {
    expect(statusOn({ status: "exempt", statusHistory: [] }, day("2020-01-01"))).toBe("exempt");
    expect(statusOn({ status: "active" }, day("2020-01-01"))).toBe("active");
  });

  it("accepts ISO strings from DTOs", () => {
    const member = { status: "deceased" as const, statusHistory: [{ status: "deceased" as const, date: "2025-11-01T19:00:00.000Z" }] };
    expect(statusOn(member, "2025-11-02T00:00:00.000Z")).toBe("deceased");
  });
});

describe("isBillableMonth", () => {
  it("bills an active member from the join month", () => {
    const member = { status: "active" as const, joinDate: day("2024-03-20"), statusHistory: [] };
    expect(isBillableMonth(member, "2024-02")).toBe(false);
    expect(isBillableMonth(member, "2024-03")).toBe(true);
    expect(isBillableMonth(member, "2026-10")).toBe(true);
  });

  it("still bills the month a member left in, but none after", () => {
    const member = {
      status: "left" as const,
      joinDate: joined,
      statusHistory: [{ status: "left" as const, date: day("2025-10-15") }],
    };
    expect(isBillableMonth(member, "2025-10")).toBe(true);
    expect(isBillableMonth(member, "2025-11")).toBe(false);
    expect(isBillableMonth(member, "2026-03")).toBe(false);
  });

  it("does not bill the month when the change is dated on its first day", () => {
    const member = {
      status: "exempt" as const,
      joinDate: joined,
      statusHistory: [{ status: "exempt" as const, date: day("2026-01-01") }],
    };
    expect(isBillableMonth(member, "2025-12")).toBe(true);
    expect(isBillableMonth(member, "2026-01")).toBe(false);
  });

  it("never bills deceased or exempt members for later months", () => {
    for (const status of ["deceased", "exempt"] as const) {
      const member = { status, joinDate: joined, statusHistory: [{ status, date: day("2025-05-20") }] };
      expect(isBillableMonth(member, "2025-06")).toBe(false);
    }
  });

  it("starts billing again the month after a member rejoins", () => {
    const member = {
      status: "active" as const,
      joinDate: joined,
      statusHistory: [
        { status: "left" as const, date: day("2025-02-10") },
        { status: "active" as const, date: day("2025-08-12") },
      ],
    };
    expect(isBillableMonth(member, "2025-08")).toBe(false);
    expect(isBillableMonth(member, "2025-09")).toBe(true);
  });
});
