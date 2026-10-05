import { describe, expect, it } from "vitest";
import { ContributionBill } from "@/models";
import { billUpsertOps, paidAmountPipeline } from "./contributions-core";

const MEMBERS = ["64b000000000000000000001", "64b000000000000000000002"];

describe("bill generation writes", () => {
  it("relies on a unique index on member + month", () => {
    const unique = ContributionBill.schema
      .indexes()
      .find(([fields, options]) => JSON.stringify(fields) === JSON.stringify({ memberId: 1, month: 1 }) && options?.unique);
    expect(unique).toBeDefined();
  });

  it("upserts keyed on member + month and only sets fields on insert", () => {
    const ops = billUpsertOps(MEMBERS, "2026-10", 500, null, "generated");
    expect(ops).toHaveLength(2);
    for (const [i, op] of ops.entries()) {
      expect(op.updateOne.upsert).toBe(true);
      expect(op.updateOne.filter.memberId.toString()).toBe(MEMBERS[i]);
      expect(op.updateOne.filter.month).toBe("2026-10");
      // Only $setOnInsert: running it again can never change or duplicate an existing bill.
      expect(Object.keys(op.updateOne.update)).toEqual(["$setOnInsert"]);
      expect(op.updateOne.update.$setOnInsert).toMatchObject({ month: "2026-10", amount: 500, paidAmount: 0, status: "unpaid" });
    }
  });

  it("gives identical writes when run twice", () => {
    const first = JSON.stringify(billUpsertOps(MEMBERS, "2026-10", 500, null, "generated"));
    const second = JSON.stringify(billUpsertOps(MEMBERS, "2026-10", 500, null, "generated"));
    expect(second).toBe(first);
  });
});

describe("paidAmountPipeline", () => {
  it("adds to paidAmount and recomputes the status, keeping waived bills waived", () => {
    const [add, status] = paidAmountPipeline(300);
    expect(add).toEqual({ $set: { paidAmount: { $add: ["$paidAmount", 300] } } });
    expect(JSON.stringify(status)).toContain('"waived"');
    expect(JSON.stringify(status)).toContain('"partial"');
  });
});
