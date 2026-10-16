import "server-only";
import { mongo, Types } from "mongoose";
import type { AccountType } from "@/lib/contributions";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import { accountFormSchema } from "@/lib/validators";
import { Account, MonthClosing, User } from "@/models";
import { accountBalance, movementsByAccount, NO_MOVEMENTS, type AccountMovements } from "./account-totals";
import { logActivity } from "./activity-log";

export {
  accountBalance,
  assertBalanceCovers,
  balanceOf,
  movementsByAccount,
  wouldGoNegative,
  type AccountMovements,
  type AccountTotals,
  type DateRange,
} from "./account-totals";

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
  // Closed months were balanced without this money; once one exists, money comes in as income or a transfer.
  if (values.openingBalance > 0 && (await MonthClosing.exists({ status: "closed" }))) throw new AppError("openingBalanceAfterClosing");
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
