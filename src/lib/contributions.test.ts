import { describe, expect, it } from "vitest";
import {
  allocatePayment,
  amountThrough,
  billStatusFor,
  buildLedger,
  buildPayableItems,
  canCancelPayment,
  formatReceiptNo,
  planBills,
  rateForMonth,
  totalDueNow,
  unbilledMonthsFor,
  type BillLike,
  type BillingMember,
  type PayableItem,
} from "./contributions";
import { parseDateKey } from "./dates";

function day(key: string): Date {
  const date = parseDateKey(key);
  if (!date) throw new Error(key);
  return date;
}

const rates = [
  { amount: 500, effectiveFrom: "2026-10" },
  { amount: 300, effectiveFrom: "2023-01" },
  { amount: 400, effectiveFrom: "2025-07" },
];

describe("rateForMonth", () => {
  it("uses the latest rate that has started", () => {
    expect(rateForMonth(rates, "2023-01")).toBe(300);
    expect(rateForMonth(rates, "2025-06")).toBe(300);
    expect(rateForMonth(rates, "2025-07")).toBe(400);
    expect(rateForMonth(rates, "2026-09")).toBe(400);
    expect(rateForMonth(rates, "2026-10")).toBe(500);
    expect(rateForMonth(rates, "2030-01")).toBe(500);
  });

  it("is null before the first rate or with no rates", () => {
    expect(rateForMonth(rates, "2022-12")).toBeNull();
    expect(rateForMonth([], "2026-10")).toBeNull();
  });
});

describe("billStatusFor", () => {
  it("follows what has been paid", () => {
    expect(billStatusFor(500, 0)).toBe("unpaid");
    expect(billStatusFor(500, 200)).toBe("partial");
    expect(billStatusFor(500, 500)).toBe("paid");
  });
});

const bill = (month: string, amount: number, paidAmount = 0, status: BillLike["status"] = "unpaid"): BillLike => ({
  id: `bill-${month}`,
  month,
  amount,
  paidAmount,
  status,
});

describe("buildPayableItems", () => {
  const items = buildPayableItems({
    openingDue: 1500,
    // Deliberately out of order; paid and waived bills drop out.
    bills: [
      bill("2026-10", 500),
      bill("2026-08", 300, 100, "partial"),
      bill("2026-07", 300, 300, "paid"),
      bill("2026-09", 300, 0, "waived"),
    ],
    unbilledMonths: [
      { month: "2026-12", amount: 500 },
      { month: "2026-11", amount: 500 },
    ],
    currentMonth: "2026-10",
  });

  it("puts the opening due first, then months oldest first", () => {
    expect(items.map((i) => i.key)).toEqual(["opening", "2026-08", "2026-10", "2026-11", "2026-12"]);
  });

  it("marks months after the current one as advance and keeps what is still owed", () => {
    expect(items.map((i) => [i.kind, i.due])).toEqual([
      ["opening", 1500],
      ["due", 200],
      ["due", 500],
      ["advance", 500],
      ["advance", 500],
    ]);
    expect(totalDueNow(items)).toBe(2200);
  });

  it("never offers an unbilled month that already has a bill", () => {
    const again = buildPayableItems({
      openingDue: 0,
      bills: [bill("2026-11", 500, 500, "paid")],
      unbilledMonths: [{ month: "2026-11", amount: 500 }],
      currentMonth: "2026-10",
    });
    expect(again).toEqual([]);
  });
});

describe("allocatePayment", () => {
  const items: PayableItem[] = [
    { key: "opening", kind: "opening", month: null, billId: null, due: 1000 },
    { key: "2026-08", kind: "due", month: "2026-08", billId: "b8", due: 300 },
    { key: "2026-09", kind: "due", month: "2026-09", billId: "b9", due: 300 },
    { key: "2026-10", kind: "due", month: "2026-10", billId: "b10", due: 500 },
    { key: "2026-11", kind: "advance", month: "2026-11", billId: null, due: 500 },
  ];
  const split = (amount: number) => allocatePayment(items, amount).lines.map((l) => [l.item.key, l.amount]);

  it("clears the opening due before any month", () => {
    expect(split(700)).toEqual([["opening", 700]]);
  });

  it("then pays the oldest unpaid months", () => {
    expect(split(1450)).toEqual([
      ["opening", 1000],
      ["2026-08", 300],
      ["2026-09", 150],
    ]);
  });

  it("only reaches future months once everything due is paid", () => {
    expect(split(2400)).toEqual([
      ["opening", 1000],
      ["2026-08", 300],
      ["2026-09", 300],
      ["2026-10", 500],
      ["2026-11", 300],
    ]);
  });

  it("reports money that does not fit anywhere", () => {
    expect(allocatePayment(items, 2700).leftover).toBe(100);
    expect(allocatePayment(items, 2600).leftover).toBe(0);
    expect(allocatePayment([], 500)).toEqual({ lines: [], leftover: 500 });
  });

  it("gives the amount that pays through a row", () => {
    expect(amountThrough(items, -1)).toBe(0);
    expect(amountThrough(items, 0)).toBe(1000);
    expect(amountThrough(items, 2)).toBe(1600);
    expect(amountThrough(items, 99)).toBe(2600);
  });
});

describe("unbilledMonthsFor", () => {
  const active = { status: "active" as const, statusHistory: [], joinDate: day("2024-01-01") };

  it("starts after the latest bill and stops 12 months ahead", () => {
    const months = unbilledMonthsFor({ member: active, lastBilledMonth: "2026-10", rates, currentMonth: "2026-10" });
    expect(months[0]).toEqual({ month: "2026-11", amount: 500 });
    expect(months.at(-1)?.month).toBe("2027-10");
    expect(months).toHaveLength(12);
  });

  it("starts at the current month when the member has no bills", () => {
    const months = unbilledMonthsFor({ member: active, lastBilledMonth: null, rates, currentMonth: "2026-10" });
    expect(months[0].month).toBe("2026-10");
  });

  it("offers nothing ahead for a member who left", () => {
    const left = { status: "left" as const, statusHistory: [{ status: "left" as const, date: day("2026-05-10") }], joinDate: day("2024-01-01") };
    expect(unbilledMonthsFor({ member: left, lastBilledMonth: "2026-05", rates, currentMonth: "2026-10" })).toEqual([]);
  });
});

describe("planBills (generation is idempotent)", () => {
  const members: BillingMember[] = [
    { id: "a", status: "active", statusHistory: [], joinDate: day("2023-01-01") },
    { id: "b", status: "active", statusHistory: [], joinDate: day("2026-10-20") },
    // Joined after October: skipped.
    { id: "c", status: "active", statusHistory: [], joinDate: day("2026-11-02") },
    { id: "d", status: "left", statusHistory: [{ status: "left", date: day("2026-06-01") }], joinDate: day("2023-01-01") },
    { id: "e", status: "exempt", statusHistory: [{ status: "exempt", date: day("2026-01-01") }], joinDate: day("2023-01-01") },
  ];

  it("bills only members who are billable that month", () => {
    expect(planBills(members, "2026-10", new Set())).toEqual({ toCreate: ["a", "b"], alreadyBilled: 0, notBillable: 3 });
  });

  it("creates nothing the second time", () => {
    const first = planBills(members, "2026-10", new Set());
    const second = planBills(members, "2026-10", new Set(first.toCreate));
    expect(second).toEqual({ toCreate: [], alreadyBilled: 2, notBillable: 3 });
  });

  it("only adds the member who was missing", () => {
    expect(planBills(members, "2026-10", new Set(["a"])).toCreate).toEqual(["b"]);
  });
});

describe("canCancelPayment", () => {
  const income = { receivedBy: "head-1", cancelled: false };

  it("lets the admin and the other head cancel", () => {
    expect(canCancelPayment({ id: "admin-1", role: "admin" }, income)).toBe(true);
    expect(canCancelPayment({ id: "head-2", role: "head" }, income)).toBe(true);
  });

  it("stops the head who received it, members, and repeats", () => {
    expect(canCancelPayment({ id: "head-1", role: "head" }, income)).toBe(false);
    expect(canCancelPayment({ id: "m-1", role: "member" }, income)).toBe(false);
    expect(canCancelPayment({ id: "admin-1", role: "admin" }, { ...income, cancelled: true })).toBe(false);
  });

  it("lets the admin cancel even their own entry", () => {
    expect(canCancelPayment({ id: "admin-1", role: "admin" }, { receivedBy: "admin-1", cancelled: false })).toBe(true);
  });
});

describe("buildLedger", () => {
  it("runs the balance in date order, ignoring waived bills and cancelled payments", () => {
    const rows = buildLedger([
      { kind: "payment", id: "p2", date: "2026-10-12T05:00:00.000Z", createdAt: "2026-10-12T05:00:00.000Z", amount: 300, receiptNumber: "R-0002", monthsCovered: ["2026-09"], openingDuePaid: 0, cancelled: true, cancelReason: "twice" },
      { kind: "bill", id: "b9", date: "2026-08-31T19:00:00.000Z", month: "2026-09", amount: 300, paidAmount: 300, status: "paid", waivedReason: "" },
      { kind: "opening", id: "opening", date: "2023-01-01T00:00:00.000Z", amount: 1000 },
      { kind: "bill", id: "b8", date: "2026-07-31T19:00:00.000Z", month: "2026-08", amount: 300, paidAmount: 0, status: "waived", waivedReason: "hospital" },
      { kind: "payment", id: "p1", date: "2026-09-10T05:00:00.000Z", createdAt: "2026-09-10T05:00:00.000Z", amount: 1300, receiptNumber: "R-0001", monthsCovered: ["2026-09"], openingDuePaid: 1000, cancelled: false, cancelReason: "" },
    ]);
    expect(rows.map((r) => [r.id, r.effect, r.balance])).toEqual([
      ["opening", 1000, 1000],
      ["b8", 0, 1000],
      ["b9", 300, 1300],
      ["p1", -1300, 0],
      ["p2", 0, 0],
    ]);
  });
});

describe("formatReceiptNo", () => {
  it("pads to four digits after the prefix", () => {
    expect(formatReceiptNo(1, "R-")).toBe("R-0001");
    expect(formatReceiptNo(12345, "EP/R-")).toBe("EP/R-12345");
  });
});
