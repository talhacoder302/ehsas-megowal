import { describe, expect, it } from "vitest";
import {
  buildClosingFigures,
  caseStateAt,
  closeBlock,
  committedAmount,
  countDifference,
  freeBalance,
  isMonthLocked,
  nextMonthToClose,
  type CaseHistoryRow,
} from "./closing";

describe("buildClosingFigures", () => {
  it("works out the closing and free balance", () => {
    const f = buildClosingFigures({
      openingBalance: 185000,
      totalIncome: 14500,
      totalDisbursed: 30000,
      totalExpenses: 1650,
      committedAmount: 45000,
      emergencyReserve: 20000,
    });
    expect(f.closingBalance).toBe(167850);
    expect(f.freeBalance).toBe(102850);
  });

  it("lets the free balance go below zero so the heads see it", () => {
    expect(freeBalance({ balance: 10000, committed: 25000, reserve: 5000 })).toBe(-20000);
  });
});

describe("locked months", () => {
  it("locks every month up to the latest closed one", () => {
    expect(isMonthLocked("2026-08", "2026-09")).toBe(true);
    expect(isMonthLocked("2026-09", "2026-09")).toBe(true);
    expect(isMonthLocked("2026-10", "2026-09")).toBe(false);
    expect(isMonthLocked("2026-10", null)).toBe(false);
  });

  it("closes months in order, starting from the first month with entries", () => {
    expect(nextMonthToClose({ lockedThrough: null, firstEntryMonth: "2026-08", current: "2026-10" })).toBe("2026-08");
    expect(nextMonthToClose({ lockedThrough: "2026-08", firstEntryMonth: "2026-08", current: "2026-10" })).toBe("2026-09");
    expect(nextMonthToClose({ lockedThrough: "2025-12", firstEntryMonth: "2025-01", current: "2026-03" })).toBe("2026-01");
    expect(nextMonthToClose({ lockedThrough: null, firstEntryMonth: null, current: "2026-10" })).toBe("2026-09");
  });
});

describe("closeBlock", () => {
  const base = { lockedThrough: "2026-08", firstEntryMonth: "2026-08", current: "2026-10", pendingApprovals: 0 };

  it("allows the next month once it has ended", () => {
    expect(closeBlock("2026-09", base)).toBeNull();
  });

  it("refuses closed, running, future and out-of-order months", () => {
    expect(closeBlock("2026-08", base)).toBe("alreadyClosed");
    expect(closeBlock("2026-07", base)).toBe("alreadyClosed");
    expect(closeBlock("2026-10", base)).toBe("notEnded");
    expect(closeBlock("2026-11", base)).toBe("notEnded");
    expect(closeBlock("2026-09", { ...base, lockedThrough: null })).toBe("closePreviousFirst");
  });

  it("waits for payments that still need a second head", () => {
    expect(closeBlock("2026-09", { ...base, pendingApprovals: 1 })).toBe("pendingApprovals");
  });
});

describe("committed money", () => {
  const at = (key: string) => new Date(`${key}T12:00:00+05:00`);
  const history: CaseHistoryRow[] = [
    { status: "requested", approvedAmount: null, changedAt: at("2026-08-02") },
    { status: "approved", approvedAmount: 60000, changedAt: at("2026-08-10") },
    { status: "in_progress", approvedAmount: null, changedAt: at("2026-09-03") },
    { status: "in_progress", approvedAmount: 70000, changedAt: at("2026-09-20") },
    { status: "completed", approvedAmount: null, changedAt: at("2026-10-05") },
  ];

  it("reads the status and approved amount at a point in time", () => {
    expect(caseStateAt(history, at("2026-08-01"))).toBeNull();
    expect(caseStateAt(history, at("2026-08-05"))).toEqual({ status: "requested", approvedAmount: null });
    expect(caseStateAt(history, at("2026-09-10"))).toEqual({ status: "in_progress", approvedAmount: 60000 });
    expect(caseStateAt(history, at("2026-10-01"))).toEqual({ status: "in_progress", approvedAmount: 70000 });
  });

  it("counts approved minus paid on cases open at that time", () => {
    expect(committedAmount([{ history, paid: 20000 }], at("2026-08-31"))).toBe(40000);
    expect(committedAmount([{ history, paid: 20000 }], at("2026-09-30"))).toBe(50000);
    // Completed cases commit nothing, even if not everything was paid.
    expect(committedAmount([{ history, paid: 20000 }], at("2026-10-31"))).toBe(0);
    // Not approved yet, or paid in full.
    expect(committedAmount([{ history, paid: 0 }], at("2026-08-05"))).toBe(0);
    expect(committedAmount([{ history, paid: 90000 }], at("2026-09-30"))).toBe(0);
  });

  it("leaves out rejected and on-hold-before-approval cases", () => {
    const rejected: CaseHistoryRow[] = [
      { status: "requested", approvedAmount: null, changedAt: at("2026-08-02") },
      { status: "rejected", approvedAmount: null, changedAt: at("2026-08-04") },
    ];
    const onHold: CaseHistoryRow[] = [
      { status: "approved", approvedAmount: 50000, changedAt: at("2026-08-02") },
      { status: "on_hold", approvedAmount: null, changedAt: at("2026-08-04") },
    ];
    expect(committedAmount([{ history: rejected, paid: 0 }], at("2026-08-31"))).toBe(0);
    // A case on hold after approval still holds its money.
    expect(committedAmount([{ history: onHold, paid: 15000 }], at("2026-08-31"))).toBe(35000);
  });
});

describe("countDifference", () => {
  it("is negative when money is missing and positive when there is extra", () => {
    expect(countDifference(120200, 120000)).toBe(-200);
    expect(countDifference(120200, 120500)).toBe(300);
    expect(countDifference(120200, 120200)).toBe(0);
  });
});
