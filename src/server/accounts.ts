import "server-only";
import { mongo, Types } from "mongoose";
import type { AccountType } from "@/lib/contributions";
import { connectDB } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { COUNTED_APPROVAL_STATUSES } from "@/lib/payouts";
import { requirePermission } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import { accountFormSchema } from "@/lib/validators";
import { Account, Disbursement, Expense, Income, Transfer, User } from "@/models";
import { logActivity } from "./activity-log";

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

const NO_MOVEMENTS: AccountMovements = { income: 0, disbursed: 0, expenses: 0, transfersIn: 0, transfersOut: 0 };

export type AccountItem = AccountMovements & {
  id: string;
  name: string;
  type: AccountType;
  holderUserId: string | null;
  holderName: string | null;
  openingBalance: number;
  balance: number;
  active: boolean;
};

export type AccountOption = { id: string; name: string; type: AccountType; holderUserId: string | null; balance: number };

export type StaffOption = { id: string; name: string; role: Role };

// ---------------------------------------------------------------------------
// Totals (internal: callers check the session)
// ---------------------------------------------------------------------------

type Sum = { _id: Types.ObjectId; total: number };

async function sumBy(model: "income" | "disbursed" | "expenses" | "transfersIn" | "transfersOut", accountIds?: Types.ObjectId[]) {
  const only = (field: string) => (accountIds ? { [field]: { $in: accountIds } } : {});
  switch (model) {
    case "income":
      return Income.aggregate<Sum>([
        { $match: { cancelled: false, ...only("accountId") } },
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

/** Income, spending and transfers per account. */
export async function movementsByAccount(accountIds?: Types.ObjectId[]): Promise<Map<string, AccountMovements>> {
  await connectDB();
  const keys = ["income", "disbursed", "expenses", "transfersIn", "transfersOut"] as const;
  const sums = await Promise.all(keys.map((key) => sumBy(key, accountIds)));
  const out = new Map<string, AccountMovements>();
  keys.forEach((key, i) => {
    for (const row of sums[i]) {
      const id = row._id.toString();
      out.set(id, { ...(out.get(id) ?? NO_MOVEMENTS), [key]: row.total });
    }
  });
  return out;
}

/** Current balance of one account. Throws accountNotFound for unknown accounts. */
export async function balanceOf(accountId: string): Promise<number> {
  await connectDB();
  if (!Types.ObjectId.isValid(accountId)) throw new AppError("accountNotFound");
  const account = await Account.findById(accountId).select("openingBalance").lean();
  if (!account) throw new AppError("accountNotFound");
  const movements = (await movementsByAccount([account._id])).get(account._id.toString()) ?? NO_MOVEMENTS;
  return accountBalance({ openingBalance: account.openingBalance, ...movements });
}

/**
 * Refuses to take `amount` out of an account that does not hold it, so no
 * action can leave a balance below zero.
 */
export async function assertBalanceCovers(accountId: string, amount: number): Promise<void> {
  if (wouldGoNegative(await balanceOf(accountId), amount)) throw new AppError("insufficientBalance");
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export async function listAccounts(): Promise<AccountItem[]> {
  await requirePermission("accounts.manage");
  const [accounts, movements] = await Promise.all([
    Account.find().sort({ active: -1, createdAt: 1 }).lean(),
    movementsByAccount(),
  ]);
  const holderIds = accounts.map((a) => a.holderUserId).filter((id): id is Types.ObjectId => Boolean(id));
  const holders = holderIds.length ? await User.find({ _id: { $in: holderIds } }).select("name").lean() : [];
  const names = new Map(holders.map((u) => [u._id.toString(), u.name]));

  return accounts.map((a) => {
    const id = a._id.toString();
    const moved = movements.get(id) ?? NO_MOVEMENTS;
    return {
      id,
      name: a.name,
      type: a.type,
      holderUserId: a.holderUserId ? a.holderUserId.toString() : null,
      holderName: a.holderUserId ? (names.get(a.holderUserId.toString()) ?? null) : null,
      openingBalance: a.openingBalance,
      ...moved,
      balance: accountBalance({ openingBalance: a.openingBalance, ...moved }),
      active: a.active,
    };
  });
}

/** Active accounts with their balance, to choose from when money comes in or goes out. */
export async function listAccountOptions(): Promise<AccountOption[]> {
  await requirePermission("payments.record");
  const [accounts, movements] = await Promise.all([
    Account.find({ active: true }).select("name type holderUserId openingBalance").sort({ createdAt: 1 }).lean(),
    movementsByAccount(),
  ]);
  return accounts.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    type: a.type,
    holderUserId: a.holderUserId ? a.holderUserId.toString() : null,
    balance: accountBalance({ openingBalance: a.openingBalance, ...(movements.get(a._id.toString()) ?? NO_MOVEMENTS) }),
  }));
}

/** Admin and heads who can hold an account. */
export async function listStaffOptions(): Promise<StaffOption[]> {
  await requirePermission("accounts.manage");
  const users = await User.find({ role: { $in: ["admin", "head"] }, status: "active" })
    .select("name role")
    .sort({ role: 1, name: 1 })
    .lean();
  return users.map((u) => ({ id: u._id.toString(), name: u.name, role: u.role }));
}

export async function createAccount(input: unknown): Promise<string> {
  const actor = await requirePermission("accounts.manage");
  const values = accountFormSchema.parse(input);

  if (values.holderUserId) {
    const holder = await User.exists({ _id: values.holderUserId, role: { $in: ["admin", "head"] }, status: "active" });
    if (!holder) throw new AppError("holderInvalid");
  }
  const taken = await Account.findOne({ name: values.name }).collation({ locale: "en", strength: 2 }).select("_id").lean();
  if (taken) throw new AppError("accountNameTaken");

  const account = await Account.create({
    name: values.name,
    type: values.type,
    holderUserId: values.holderUserId ? new Types.ObjectId(values.holderUserId) : null,
    openingBalance: values.openingBalance,
    createdBy: new Types.ObjectId(actor.id),
  }).catch((error: unknown) => {
    if (error instanceof mongo.MongoServerError && error.code === 11000) throw new AppError("accountNameTaken");
    throw error;
  });

  await logActivity({
    actorId: actor.id,
    action: "account.created",
    entity: "Account",
    entityId: account._id,
    meta: { name: values.name, type: values.type, openingBalance: values.openingBalance },
  });
  return account._id.toString();
}
