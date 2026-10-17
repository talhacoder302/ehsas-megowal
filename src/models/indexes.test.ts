import { describe, expect, it } from "vitest";
import type { Model } from "mongoose";
import { ActivityLog, AidCase, CashCount, ContributionBill, Disbursement, Expense, Income, Member, MonthClosing } from "@/models";

/** Index key patterns of a model, as JSON strings. */
function keys(model: Model<never>): string[] {
  return model.schema.indexes().map(([fields]) => JSON.stringify(fields));
}

// The lists, dashboard, reports and closings rely on these. Removing one makes
// a common screen scan a whole collection.
const EXPECTED: [string, Model<never>, Record<string, number>[]][] = [
  ["Income", Income as unknown as Model<never>, [{ cancelled: 1, date: -1, createdAt: -1 }, { memberId: 1, date: 1 }, { date: -1, createdAt: -1 }]],
  ["ContributionBill", ContributionBill as unknown as Model<never>, [{ memberId: 1, month: 1 }, { month: 1, status: 1 }, { status: 1, month: 1 }, { origin: 1, month: 1 }]],
  ["Disbursement", Disbursement as unknown as Model<never>, [{ caseId: 1, date: 1 }, { approvalStatus: 1, createdAt: 1 }, { date: 1, approvalStatus: 1 }]],
  ["Expense", Expense as unknown as Model<never>, [{ date: -1, createdAt: -1 }]],
  ["Member", Member as unknown as Model<never>, [{ status: 1, name: 1 }, { name: 1, fatherName: 1 }, { mobile: 1 }]],
  ["AidCase", AidCase as unknown as Model<never>, [{ status: 1, lastUpdateAt: 1 }, { createdAt: -1 }, { approvedAmount: 1 }]],
  ["ActivityLog", ActivityLog as unknown as Model<never>, [{ createdAt: -1 }, { "meta.memberId": 1, createdAt: -1 }]],
  ["CashCount", CashCount as unknown as Model<never>, [{ date: -1 }]],
  ["MonthClosing", MonthClosing as unknown as Model<never>, [{ status: 1, month: -1 }]],
];

describe("indexes for common queries", () => {
  it.each(EXPECTED)("%s has its indexes", (_name, model, wanted) => {
    const have = keys(model);
    for (const index of wanted) expect(have).toContain(JSON.stringify(index));
  });
});
