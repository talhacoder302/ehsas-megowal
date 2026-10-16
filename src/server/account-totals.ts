import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { NOT_FROM_REGISTER } from "@/lib/contributions";
import { COUNTED_APPROVAL_STATUSES } from "@/lib/payouts";
import { Account, Disbursement, Expense, Income, Transfer } from "@/models";

// Account balances. Internal: no session checks (callers check it), and no
// auth imports, so scripts and closing-core.ts can use it.

/** Everything that moves an account balance, in whole rupees. */
export type AccountTotals = {
  openingBalance: number;
  /** Money received (cancelled payments left out). */
  income: number;
  /** Aid paid out (pending and rejected disbursements left out). */
  disbursed: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
};

/** Balance = openingBalance + income − approved disbursements − expenses ± transfers. */
export function accountBalance(t: AccountTotals): number {
  return t.openingBalance + t.income - t.disbursed - t.expenses + t.transfersIn - t.transfersOut;
}

/** Taking `amount` out of an account with `balance` would leave it below zero. */
export function wouldGoNegative(balance: number, amount: number): boolean {
  return amount > balance;
}

export type AccountMovements = Omit<AccountTotals, "openingBalance">;

export const NO_MOVEMENTS: AccountMovements = { income: 0, disbursed: 0, expenses: 0, transfersIn: 0, transfersOut: 0 };

type Sum = { _id: Types.ObjectId; total: number };

/** Entries dated from `from` (included) to `to` (left out). Either end may be open. */
export type DateRange = { from?: Date; to?: Date };

async function sumBy(
  model: "income" | "disbursed" | "expenses" | "transfersIn" | "transfersOut",
  accountIds?: Types.ObjectId[],
  range: DateRange = {},
) {
  const dated = range.from || range.to ? { date: { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lt: range.to } : {}) } } : {};
  const only = (field: string) => ({ ...(accountIds ? { [field]: { $in: accountIds } } : {}), ...dated });
  switch (model) {
    case "income":
      return Income.aggregate<Sum>([
        { $match: { cancelled: false, ...NOT_FROM_REGISTER, ...only("accountId") } },
        { $group: { _id: "$accountId", total: { $sum: "$amount" } } },
      ]);
    case "disbursed":
      return Disbursement.aggregate<Sum>([
        { $match: { approvalStatus: { $in: [...COUNTED_APPROVAL_STATUSES] }, ...only("accountId") } },
        { $group: { _id: "$accountId", total: { $sum: "$amount" } } },
      ]);
    case "expenses":
      return Expense.aggregate<Sum>([{ $match: only("accountId") }, { $group: { _id: "$accountId", total: { $sum: "$amount" } } }]);
    case "transfersIn":
      return Transfer.aggregate<Sum>([{ $match: only("toAccountId") }, { $group: { _id: "$toAccountId", total: { $sum: "$amount" } } }]);
    case "transfersOut":
      return Transfer.aggregate<Sum>([
        { $match: only("fromAccountId") },
        { $group: { _id: "$fromAccountId", total: { $sum: "$amount" } } },
      ]);
  }
}

/** Income, spending and transfers per account, optionally only those dated in `range`. */
export async function movementsByAccount(accountIds?: Types.ObjectId[], range?: DateRange): Promise<Map<string, AccountMovements>> {
  await connectDB();
  const keys = ["income", "disbursed", "expenses", "transfersIn", "transfersOut"] as const;
  const sums = await Promise.all(keys.map((key) => sumBy(key, accountIds, range)));
  const out = new Map<string, AccountMovements>();
  keys.forEach((key, i) => {
    for (const row of sums[i]) {
      const id = row._id.toString();
      out.set(id, { ...(out.get(id) ?? NO_MOVEMENTS), [key]: row.total });
    }
  });
  return out;
}

/**
 * Balance of one account now, or counting only entries dated before `before`.
 * Throws accountNotFound for unknown accounts.
 */
export async function balanceOf(accountId: string, before?: Date): Promise<number> {
  await connectDB();
  if (!Types.ObjectId.isValid(accountId)) throw new AppError("accountNotFound");
  const account = await Account.findById(accountId).select("openingBalance").lean();
  if (!account) throw new AppError("accountNotFound");
  const range = before ? { to: before } : undefined;
  const movements = (await movementsByAccount([account._id], range)).get(account._id.toString()) ?? NO_MOVEMENTS;
  return accountBalance({ openingBalance: account.openingBalance, ...movements });
}

/**
 * Refuses to take `amount` out of an account that does not hold it, so no
 * action can leave a balance below zero.
 */
export async function assertBalanceCovers(accountId: string, amount: number): Promise<void> {
  if (wouldGoNegative(await balanceOf(accountId), amount)) throw new AppError("insufficientBalance");
}
