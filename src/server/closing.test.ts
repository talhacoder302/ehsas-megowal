import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/roles";

// The guards load Auth.js, which does not run under Vitest; each test picks the signed-in role.
let role: Role | null = null;
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => (role ? { id: "64b000000000000000000009", role, memberId: null } : null),
}));

const { closeMonth, getBudget, getClosingView, reopenMonth } = await import("./closing");
const { listCashCounts, recordCashCount } = await import("./cash-counts");
const { CLOSE_BLOCK_ERRORS } = await import("./closing-core");
const { MonthClosing } = await import("@/models");

beforeEach(() => {
  role = null;
});

describe("who may keep the books", () => {
  it("keeps signed-out users and members away from closing and cash counts", async () => {
    await expect(closeMonth("2026-09")).rejects.toMatchObject({ code: "unauthenticated" });
    role = "member";
    await expect(closeMonth("2026-09")).rejects.toMatchObject({ code: "forbidden" });
    await expect(getClosingView()).rejects.toMatchObject({ code: "forbidden" });
    await expect(getBudget()).rejects.toMatchObject({ code: "forbidden" });
    await expect(listCashCounts()).rejects.toMatchObject({ code: "forbidden" });
    await expect(recordCashCount({})).rejects.toMatchObject({ code: "forbidden" });
  });

  it("lets only the admin reopen a month", async () => {
    role = "head";
    await expect(reopenMonth("2026-09", { reason: "Wrong date on a payment" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("month closing records", () => {
  it("has one document per month", () => {
    const unique = MonthClosing.schema.indexes().find(([fields, options]) => JSON.stringify(fields) === JSON.stringify({ month: 1 }) && options?.unique);
    const pathUnique = MonthClosing.schema.path("month").options.unique;
    expect(unique ?? pathUnique).toBeTruthy();
  });

  it("gives every reason a month cannot be closed its own message", () => {
    expect(Object.keys(CLOSE_BLOCK_ERRORS).sort()).toEqual(["alreadyClosed", "closePreviousFirst", "notEnded", "pendingApprovals"]);
  });
});
