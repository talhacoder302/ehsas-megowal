import { describe, expect, it } from "vitest";
import { collectionCounts, groupAid, groupExpenses, lastMonths, reportMonths, reportVersionFor, showsBeneficiary } from "./reports";

describe("report versions", () => {
  it("never gives members the heads version", () => {
    expect(reportVersionFor("member", "heads")).toBe("members");
    expect(reportVersionFor("member", undefined)).toBe("members");
  });

  it("lets staff choose, heads copy by default", () => {
    expect(reportVersionFor("head", undefined)).toBe("heads");
    expect(reportVersionFor("head", "members")).toBe("members");
    expect(reportVersionFor("admin", "nonsense")).toBe("heads");
  });

  it("shows names in the members copy only where the family agreed", () => {
    expect(showsBeneficiary("heads", { showNameToMembers: false })).toBe(true);
    expect(showsBeneficiary("members", { showNameToMembers: false })).toBe(false);
    expect(showsBeneficiary("members", { showNameToMembers: true })).toBe(true);
  });
});

describe("groupAid", () => {
  it("groups by category in the usual order and adds up instalments per case", () => {
    const groups = groupAid([
      { caseId: "c8", caseNo: "C-0008", category: "ration", beneficiaryName: null, amount: 5000 },
      { caseId: "c1", caseNo: "C-0001", category: "wedding", beneficiaryName: "Shazia Bibi", amount: 20000 },
      { caseId: "c8", caseNo: "C-0008", category: "ration", beneficiaryName: null, amount: 5000 },
      { caseId: "c2", caseNo: "C-0002", category: "wedding", beneficiaryName: null, amount: 15000 },
    ]);
    expect(groups.map((g) => g.category)).toEqual(["wedding", "ration"]);
    expect(groups[0]).toEqual({
      category: "wedding",
      total: 35000,
      cases: [
        { caseNo: "C-0001", beneficiaryName: "Shazia Bibi", amount: 20000 },
        { caseNo: "C-0002", beneficiaryName: null, amount: 15000 },
      ],
    });
    expect(groups[1].cases).toEqual([{ caseNo: "C-0008", beneficiaryName: null, amount: 10000 }]);
  });

  it("is empty when nothing was paid", () => {
    expect(groupAid([])).toEqual([]);
  });
});

describe("groupExpenses", () => {
  it("totals and counts each category", () => {
    expect(
      groupExpenses([
        { category: "printing", amount: 1200 },
        { category: "stationery", amount: 450 },
        { category: "printing", amount: 300 },
      ]),
    ).toEqual([
      { category: "stationery", total: 450, count: 1 },
      { category: "printing", total: 1500, count: 2 },
    ]);
  });
});

describe("collectionCounts", () => {
  it("counts paid members out of those billed for the month", () => {
    expect(
      collectionCounts([
        { billable: true, paid: true },
        { billable: true, paid: false },
        { billable: false, paid: false },
        { billable: true, paid: true },
      ]),
    ).toEqual({ activeMembers: 3, paidMembers: 2 });
  });
});

describe("report months", () => {
  it("lists months newest first from the first month with entries", () => {
    expect(reportMonths("2026-08", "2026-10")).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(reportMonths(null, "2026-10")).toEqual(["2026-10"]);
    expect(reportMonths("2027-01", "2026-10")).toEqual(["2026-10"]);
  });

  it("gives the 12 chart months oldest first, across a year end", () => {
    const months = lastMonths("2026-03", 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-04");
    expect(months[11]).toBe("2026-03");
  });
});
