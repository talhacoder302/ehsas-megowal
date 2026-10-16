import "server-only";
import { Types } from "mongoose";
import { countDifference } from "@/lib/closing";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { cashCountFormSchema } from "@/lib/validators";
import { Account, CashCount, User } from "@/models";
import { balanceOf } from "./accounts";
import { logActivity } from "./activity-log";

export type CashCountItem = {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  systemBalance: number;
  countedAmount: number;
  difference: number;
  note: string;
  countedByName: string;
};

/** Past counts, newest first. */
export async function listCashCounts(limit = 100): Promise<CashCountItem[]> {
  await requirePermission("cash.count");
  const rows = await CashCount.find().sort({ date: -1 }).limit(limit).lean();
  const [accounts, users] = await Promise.all([
    Account.find({ _id: { $in: [...new Set(rows.map((r) => r.accountId.toString()))] } }).select("name").lean(),
    User.find({ _id: { $in: [...new Set(rows.map((r) => r.countedBy.toString()))] } }).select("name").lean(),
  ]);
  const accountName = new Map(accounts.map((a) => [a._id.toString(), a.name]));
  const userName = new Map(users.map((u) => [u._id.toString(), u.name]));
  return rows.map((r) => ({
    id: r._id.toString(),
    accountId: r.accountId.toString(),
    accountName: accountName.get(r.accountId.toString()) ?? "",
    date: r.date.toISOString(),
    systemBalance: r.systemBalance,
    countedAmount: r.countedAmount,
    difference: r.difference,
    note: r.note,
    countedByName: userName.get(r.countedBy.toString()) ?? "",
  }));
}

/**
 * Records what a head physically counted. The system balance is read again
 * here; if money moved since the head opened the screen the count is refused
 * so they compare against the right number.
 */
export async function recordCashCount(input: unknown): Promise<{ id: string; difference: number }> {
  const actor = await requirePermission("cash.count");
  const values = cashCountFormSchema.parse(input);
  if (!(await Account.exists({ _id: values.accountId, active: true }))) throw new AppError("accountNotFound");
  const systemBalance = await balanceOf(values.accountId);
  if (systemBalance !== values.systemBalance) throw new AppError("balanceChangedMeanwhile");
  const difference = countDifference(systemBalance, values.countedAmount);

  const count = await CashCount.create({
    accountId: new Types.ObjectId(values.accountId),
    date: new Date(),
    systemBalance,
    countedAmount: values.countedAmount,
    difference,
    note: values.note,
    countedBy: new Types.ObjectId(actor.id),
  });
  await logActivity({
    actorId: actor.id,
    action: "cash.counted",
    entity: "CashCount",
    entityId: count._id,
    meta: { accountId: values.accountId, systemBalance, countedAmount: values.countedAmount, difference, note: values.note },
  });
  return { id: count._id.toString(), difference };
}
