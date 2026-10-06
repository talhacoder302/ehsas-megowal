import { describe, expect, it } from "vitest";
import {
  allowedNextStatuses,
  canMoveTo,
  caseTab,
  daysSince,
  formatCaseNo,
  isStale,
  lastReason,
  needsAttention,
  redactCase,
  remainingAmount,
  statusBeforeHold,
  type CaseStatus,
} from "./cases";
import { caseStatusChangeSchema } from "./validators";

const history = (...statuses: CaseStatus[]) => statuses.map((status) => ({ status }));

describe("allowedNextStatuses", () => {
  it("follows requested → verifying → approved → in_progress → completed", () => {
    expect(allowedNextStatuses({ status: "requested", approvedAmount: null, statusHistory: history("requested") })).toEqual([
      "verifying",
      "on_hold",
      "rejected",
    ]);
    expect(allowedNextStatuses({ status: "verifying", approvedAmount: null, statusHistory: history("requested", "verifying") })[0]).toBe(
      "approved",
    );
    expect(allowedNextStatuses({ status: "approved", approvedAmount: 50000, statusHistory: [] })[0]).toBe("in_progress");
    expect(allowedNextStatuses({ status: "in_progress", approvedAmount: 50000, statusHistory: [] })[0]).toBe("completed");
  });

  it("does not skip steps", () => {
    const state = { status: "requested" as const, approvedAmount: null, statusHistory: history("requested") };
    expect(canMoveTo(state, "approved")).toBe(false);
    expect(canMoveTo(state, "completed")).toBe(false);
  });

  it("allows on hold and rejected from every open state, nothing from closed ones", () => {
    for (const status of ["requested", "verifying", "approved", "in_progress"] as const) {
      const options = allowedNextStatuses({ status, approvedAmount: 1000, statusHistory: [] });
      expect(options).toContain("on_hold");
      expect(options).toContain("rejected");
    }
    expect(allowedNextStatuses({ status: "completed", approvedAmount: 1000, statusHistory: [] })).toEqual([]);
    expect(allowedNextStatuses({ status: "rejected", approvedAmount: null, statusHistory: [] })).toEqual([]);
  });

  it("brings an approved case back from hold to in progress", () => {
    const state = {
      status: "on_hold" as const,
      approvedAmount: 80000,
      statusHistory: history("requested", "verifying", "approved", "in_progress", "on_hold"),
    };
    expect(allowedNextStatuses(state)).toEqual(["in_progress", "rejected"]);
  });

  it("never lets a hold skip the approval", () => {
    const state = { status: "on_hold" as const, approvedAmount: null, statusHistory: history("requested", "verifying", "on_hold") };
    expect(allowedNextStatuses(state)).toEqual(["verifying", "rejected"]);
    expect(canMoveTo(state, "in_progress")).toBe(false);
  });
});

describe("statusBeforeHold", () => {
  it("finds the status the case had before its latest hold", () => {
    expect(statusBeforeHold(history("requested", "verifying", "on_hold"))).toBe("verifying");
    expect(statusBeforeHold(history("requested", "on_hold", "requested", "verifying", "approved", "on_hold"))).toBe("approved");
    expect(statusBeforeHold(history("requested"))).toBeNull();
  });
});

describe("tabs, staleness and attention", () => {
  const now = new Date("2026-10-06T10:00:00.000Z");

  it("puts every status in one tab", () => {
    expect(caseTab("on_hold")).toBe("open");
    expect(caseTab("completed")).toBe("completed");
    expect(caseTab("rejected")).toBe("rejected");
  });

  it("flags open cases with no update for more than 7 days", () => {
    expect(daysSince("2026-09-28T10:00:00.000Z", now)).toBe(8);
    expect(isStale("verifying", "2026-09-28T10:00:00.000Z", now)).toBe(true);
    expect(isStale("verifying", "2026-09-29T10:00:00.000Z", now)).toBe(false);
    expect(isStale("completed", "2026-01-01T00:00:00.000Z", now)).toBe(false);
  });

  it("always flags cases on hold", () => {
    expect(needsAttention("on_hold", now.toISOString(), now)).toBe(true);
    expect(needsAttention("in_progress", now.toISOString(), now)).toBe(false);
  });

  it("shows the latest written reason", () => {
    expect(lastReason([{ reason: "" }, { reason: "Hospital ka bill abhi nahi aaya" }, { reason: "  " }])).toBe(
      "Hospital ka bill abhi nahi aaya",
    );
    expect(lastReason([{ reason: "" }])).toBe("");
  });
});

describe("money and numbers", () => {
  it("formats case numbers", () => {
    expect(formatCaseNo(14, "C-")).toBe("C-0014");
  });

  it("works out what is left to pay", () => {
    expect(remainingAmount({ estimatedAmount: 60000, approvedAmount: null, paidAmount: 0 })).toBe(60000);
    expect(remainingAmount({ estimatedAmount: 60000, approvedAmount: 50000, paidAmount: 20000 })).toBe(30000);
    expect(remainingAmount({ estimatedAmount: 60000, approvedAmount: 50000, paidAmount: 55000 })).toBe(0);
  });
});

describe("redactCase", () => {
  const item = {
    id: "1",
    caseNo: "C-0001",
    beneficiaryName: "Shazia Bibi",
    guardianName: "Muhammad Akram",
    contactMobile: "03001234567",
    mohalla: "Mohalla Arain",
    description: "Beti ki shadi",
    approvedAmount: 50000,
  };

  it("removes everything that could identify the family", () => {
    expect(redactCase(item, false)).toEqual({
      ...item,
      beneficiaryName: null,
      guardianName: null,
      contactMobile: null,
      mohalla: null,
      description: null,
    });
  });

  it("keeps the details when the viewer may see them", () => {
    expect(redactCase(item, true)).toBe(item);
  });
});

describe("caseStatusChangeSchema", () => {
  it("needs a reason for every change", () => {
    const result = caseStatusChangeSchema.safeParse({ status: "verifying", reason: "", approvedAmount: "" });
    expect(result.error?.issues[0].message).toBe("reasonRequired");
  });

  it("needs an amount to approve", () => {
    const missing = caseStatusChangeSchema.safeParse({ status: "approved", reason: "Committee agreed", approvedAmount: "" });
    expect(missing.error?.issues[0]).toMatchObject({ message: "approvedAmountRequired", path: ["approvedAmount"] });
    expect(caseStatusChangeSchema.parse({ status: "approved", reason: "Committee agreed", approvedAmount: "50,000" }).approvedAmount).toBe(50000);
  });

  it("accepts its own output again (the form sends parsed values to the server)", () => {
    for (const input of [
      { status: "verifying", reason: "Report dekh li", approvedAmount: "" },
      { status: "approved", reason: "Committee agreed", approvedAmount: "40000" },
    ] as const) {
      const once = caseStatusChangeSchema.parse(input);
      expect(caseStatusChangeSchema.parse(once)).toEqual(once);
    }
  });

  it("ignores the amount for other statuses", () => {
    expect(caseStatusChangeSchema.parse({ status: "on_hold", reason: "Hospital ka bill abhi nahi aaya", approvedAmount: "999" }).approvedAmount).toBeNull();
  });
});
