import { describe, expect, it, vi } from "vitest";

// The guards load Auth.js, which does not run under Vitest.
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser: async () => null }));
const { accountBalance, wouldGoNegative } = await import("./accounts");

const base = { openingBalance: 0, income: 0, disbursed: 0, expenses: 0, transfersIn: 0, transfersOut: 0 };

describe("accountBalance", () => {
  it("is opening + income − disbursements − expenses ± transfers", () => {
    expect(
      accountBalance({ openingBalance: 185000, income: 27450, disbursed: 80000, expenses: 2250, transfersIn: 5000, transfersOut: 10000 }),
    ).toBe(185000 + 27450 - 80000 - 2250 + 5000 - 10000);
  });

  it("starts from the opening balance", () => {
    expect(accountBalance({ ...base, openingBalance: 2500 })).toBe(2500);
  });

  it("moves money between accounts without changing the total", () => {
    const cash = accountBalance({ ...base, openingBalance: 50000, transfersOut: 20000 });
    const bank = accountBalance({ ...base, transfersIn: 20000 });
    expect(cash + bank).toBe(50000);
  });
});

describe("wouldGoNegative", () => {
  it("allows taking out everything, but not a rupee more", () => {
    expect(wouldGoNegative(1000, 1000)).toBe(false);
    expect(wouldGoNegative(1000, 1001)).toBe(true);
    expect(wouldGoNegative(0, 1)).toBe(true);
  });
});
