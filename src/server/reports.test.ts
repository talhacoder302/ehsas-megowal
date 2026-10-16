import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/roles";

// The guards load Auth.js, which does not run under Vitest; each test picks the signed-in role.
let role: Role | null = null;
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => (role ? { id: "64b000000000000000000009", role, memberId: "64b000000000000000000001" } : null),
}));

const { getMonthlyReport } = await import("./reports");
const { countReportEmailRecipients, emailMonthlyReport } = await import("./report-email");
const { getMemberHome } = await import("./member-portal");

beforeEach(() => {
  role = null;
});

describe("who may see reports", () => {
  it("needs a signed-in user", async () => {
    await expect(getMonthlyReport("2026-09")).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(getMemberHome()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("checks the month before touching the database", async () => {
    role = "member";
    await expect(getMonthlyReport("September")).rejects.toMatchObject({ code: "invalidInput" });
    await expect(getMonthlyReport("2999-01")).rejects.toMatchObject({ code: "monthInFuture" });
  });

  it("does not let members email the report", async () => {
    role = "member";
    await expect(emailMonthlyReport("2026-09")).rejects.toMatchObject({ code: "forbidden" });
    await expect(countReportEmailRecipients()).rejects.toMatchObject({ code: "forbidden" });
  });
});
