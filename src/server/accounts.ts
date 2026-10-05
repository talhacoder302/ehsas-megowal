import "server-only";
import { mongo, Types } from "mongoose";
import type { AccountType } from "@/lib/contributions";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import { accountFormSchema } from "@/lib/validators";
import { Account, User } from "@/models";
import { logActivity } from "./activity-log";
import { incomeByAccount } from "./contributions-core";

export type AccountItem = {
  id: string;
  name: string;
  type: AccountType;
  holderUserId: string | null;
  holderName: string | null;
  openingBalance: number;
  /** Money received into this account (cancelled payments left out). */
  received: number;
  /** openingBalance + received. Spending is subtracted once expenses and aid are recorded. */
  balance: number;
  active: boolean;
};

export type AccountOption = { id: string; name: string; type: AccountType; holderUserId: string | null };

export type StaffOption = { id: string; name: string; role: Role };

export async function listAccounts(): Promise<AccountItem[]> {
  await requirePermission("accounts.manage");
  const [accounts, received] = await Promise.all([
    Account.find().sort({ active: -1, createdAt: 1 }).lean(),
    incomeByAccount(),
  ]);
  const holderIds = accounts.map((a) => a.holderUserId).filter((id): id is Types.ObjectId => Boolean(id));
  const holders = holderIds.length ? await User.find({ _id: { $in: holderIds } }).select("name").lean() : [];
  const names = new Map(holders.map((u) => [u._id.toString(), u.name]));

  return accounts.map((a) => {
    const id = a._id.toString();
    const income = received.get(id) ?? 0;
    return {
      id,
      name: a.name,
      type: a.type,
      holderUserId: a.holderUserId ? a.holderUserId.toString() : null,
      holderName: a.holderUserId ? (names.get(a.holderUserId.toString()) ?? null) : null,
      openingBalance: a.openingBalance,
      received: income,
      balance: a.openingBalance + income,
      active: a.active,
    };
  });
}

/** Active accounts to choose from when receiving money. */
export async function listAccountOptions(): Promise<AccountOption[]> {
  await requirePermission("payments.record");
  const accounts = await Account.find({ active: true }).select("name type holderUserId").sort({ createdAt: 1 }).lean();
  return accounts.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    type: a.type,
    holderUserId: a.holderUserId ? a.holderUserId.toString() : null,
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
