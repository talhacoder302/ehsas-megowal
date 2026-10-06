import { describe, expect, it } from "vitest";
import { canApproveDisbursement, disbursementCounts, exceedsApproved, isFullyPaid, needsSecondApproval, payableLeft } from "./payouts";

describe("disbursementCounts", () => {
  it("counts paid and approved payments, not pending or rejected ones", () => {
    expect(disbursementCounts("not_required")).toBe(true);
    expect(disbursementCounts("approved")).toBe(true);
    expect(disbursementCounts("pending")).toBe(false);
    expect(disbursementCounts("rejected")).toBe(false);
  });
});

describe("needsSecondApproval", () => {
  it("only when switched on and above the limit", () => {
    expect(needsSecondApproval({ enabled: true, limit: 25000 }, 25000)).toBe(false);
    expect(needsSecondApproval({ enabled: true, limit: 25000 }, 25001)).toBe(true);
    expect(needsSecondApproval({ enabled: false, limit: 25000 }, 90000)).toBe(false);
  });
});

describe("canApproveDisbursement", () => {
  const pending = { paidBy: "head-1", approvalStatus: "pending" as const };

  it("lets a different head or the admin decide", () => {
    expect(canApproveDisbursement({ id: "head-2", role: "head" }, pending)).toBe(true);
    expect(canApproveDisbursement({ id: "admin-1", role: "admin" }, pending)).toBe(true);
  });

  it("never lets the person who entered it approve it", () => {
    expect(canApproveDisbursement({ id: "head-1", role: "head" }, pending)).toBe(false);
    expect(canApproveDisbursement({ id: "admin-1", role: "admin" }, { ...pending, paidBy: "admin-1" })).toBe(false);
  });

  it("only applies to pending payments, and never to members", () => {
    expect(canApproveDisbursement({ id: "head-2", role: "head" }, { ...pending, approvalStatus: "approved" })).toBe(false);
    expect(canApproveDisbursement({ id: "m-1", role: "member" }, pending)).toBe(false);
  });
});

describe("approved amount limits", () => {
  const state = { approvedAmount: 60000, paid: 20000, pending: 30000 };

  it("counts pending payments against the approved amount", () => {
    expect(payableLeft(state)).toBe(10000);
    expect(exceedsApproved(state, 10000)).toBe(false);
    expect(exceedsApproved(state, 10001)).toBe(true);
  });

  it("allows nothing on a case without an approved amount", () => {
    expect(payableLeft({ approvedAmount: null, paid: 0, pending: 0 })).toBe(0);
    expect(exceedsApproved({ approvedAmount: null, paid: 0, pending: 0 }, 1)).toBe(true);
  });

  it("is fully paid once paid reaches the approved amount", () => {
    expect(isFullyPaid({ approvedAmount: 60000, paid: 59999 })).toBe(false);
    expect(isFullyPaid({ approvedAmount: 60000, paid: 60000 })).toBe(true);
    expect(isFullyPaid({ approvedAmount: null, paid: 100 })).toBe(false);
  });
});
