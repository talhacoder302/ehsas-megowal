import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import type { Role } from "@/lib/roles";

// Who is signed in for each test. Every check below fails at the guard, before
// any database access, so no database is needed.
let role: Role | null = null;
const OWN_MEMBER = "64b000000000000000000001";
const OTHER_MEMBER = "64b000000000000000000002";
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () =>
    role ? { id: "64b000000000000000000009", name: "Test", role, memberId: role === "member" ? OWN_MEMBER : null } : null,
}));

const id = new Types.ObjectId().toString();
const members = await import("./members");
const payments = await import("./payments");
const cases = await import("./cases");
const disbursements = await import("./disbursements");
const expenses = await import("./expenses");
const accounts = await import("./accounts");
const bills = await import("./bills");
const pending = await import("./pending");
const closing = await import("./closing");
const cashCounts = await import("./cash-counts");
const dashboard = await import("./dashboard");
const setup = await import("./setup");
const users = await import("./users");
const rates = await import("./rates");
const ledger = await import("./ledger");
const backup = await import("./backup");
const exportSheet = await import("./members-export");

/** Staff-only work a member must never reach, whatever they send. */
const STAFF_ONLY: [string, () => Promise<unknown>][] = [
  ["list members", () => members.listMembers()],
  ["read a member", () => members.getMemberDetail(OTHER_MEMBER)],
  ["add a member", () => members.createMember({})],
  ["export members", () => exportSheet.buildMembersWorkbook(null, "en")],
  ["list payments", () => payments.listPayments()],
  ["receive a payment", () => payments.receivePayment({})],
  ["cancel a payment", () => payments.cancelPayment(id, { reason: "test reason" })],
  ["read a receipt", () => payments.getReceipt(id)],
  ["list cases with names", () => cases.listCases()],
  ["read a case", () => cases.getCase(id)],
  ["open a case", () => cases.createCase({})],
  ["pay aid", () => disbursements.recordDisbursement(id, {})],
  ["approve aid", () => disbursements.approveDisbursement(id)],
  ["list expenses", () => expenses.listExpenses()],
  ["add an expense", () => expenses.createExpense({})],
  ["move money", () => expenses.createTransfer({})],
  ["list accounts", () => accounts.listAccounts()],
  ["add an account", () => accounts.createAccount({})],
  ["generate bills", () => bills.generateBills("2026-10")],
  ["pending list", () => pending.getPendingReport("2026-10")],
  ["month closing", () => closing.getClosingView()],
  ["close a month", () => closing.closeMonth("2026-09")],
  ["budget", () => closing.getBudget()],
  ["cash counts", () => cashCounts.listCashCounts()],
  ["dashboard", () => dashboard.getDashboard()],
  ["opening setup", () => setup.getSetupState()],
  ["users", () => users.listUsers()],
  ["rates", () => rates.listRates()],
  ["full backup", () => backup.buildBackupWorkbook()],
];

beforeEach(() => {
  role = null;
});

describe("members are kept out of staff work", () => {
  it.each(STAFF_ONLY)("%s", async (_name, call) => {
    role = "member";
    await expect(call()).rejects.toMatchObject({ code: "forbidden" });
  });

  it("cannot read another member's contributions", async () => {
    role = "member";
    await expect(ledger.getMemberLedger(OTHER_MEMBER)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("signed-out visitors get nothing", () => {
  it.each(STAFF_ONLY)("%s", async (_name, call) => {
    await expect(call()).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("admin-only work", () => {
  it("heads cannot download the full backup", async () => {
    role = "head";
    await expect(backup.buildBackupWorkbook()).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("backup cells", () => {
  it("keeps ids, dates and nested values readable", () => {
    const oid = new Types.ObjectId("64b000000000000000000003");
    expect(backup.backupCell(oid)).toBe("64b000000000000000000003");
    expect(backup.backupCell(new Date("2026-10-01T00:00:00.000Z"))).toBe("2026-10-01T00:00:00.000Z");
    expect(backup.backupCell([{ billId: oid, month: "2026-09" }])).toBe('[{"billId":"64b000000000000000000003","month":"2026-09"}]');
    expect(backup.backupCell(null)).toBe("");
    expect(backup.backupCell(500)).toBe(500);
  });

  it("puts every field in a column, _id first, without __v", () => {
    const rows = backup.backupRows([
      { _id: "a", name: "Ali", __v: 0 },
      { _id: "b", name: "Bilal", email: "b@example.com" },
    ]);
    expect(rows).toEqual([
      ["_id", "name", "email"],
      ["a", "Ali", ""],
      ["b", "Bilal", "b@example.com"],
    ]);
  });
});
