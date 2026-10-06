import "server-only";
import { Types } from "mongoose";
import { parseDateKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import type { ExpenseCategory } from "@/lib/payouts";
import { requirePermission } from "@/lib/permissions";
import { expenseFormSchema, transferFormSchema } from "@/lib/validators";
import { Account, Expense, Transfer, User } from "@/models";
import { assertBalanceCovers } from "./accounts";
import { logActivity } from "./activity-log";
import { photoViewUrl } from "./storage";

export type ExpenseItem = {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  accountName: string;
  createdByName: string;
  photoUrl: string | null;
};

export type TransferItem = {
  id: string;
  fromAccountName: string;
  toAccountName: string;
  amount: number;
  date: string;
  note: string;
  createdByName: string;
};

async function names(model: "user" | "account", ids: Types.ObjectId[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return new Map();
  const rows =
    model === "user"
      ? await User.find({ _id: { $in: unique } }).select("name").lean()
      : await Account.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(rows.map((r) => [r._id.toString(), r.name]));
}

async function activeAccountOrThrow(accountId: string): Promise<void> {
  if (!(await Account.exists({ _id: accountId, active: true }))) throw new AppError("accountNotFound");
}

// ---------------------------------------------------------------------------
// Expenses: program costs not tied to a case
// ---------------------------------------------------------------------------

export async function listExpenses(limit = 300): Promise<ExpenseItem[]> {
  await requirePermission("expenses.manage");
  const rows = await Expense.find().sort({ date: -1, createdAt: -1 }).limit(limit).lean();
  const [users, accounts] = await Promise.all([names("user", rows.map((r) => r.createdBy)), names("account", rows.map((r) => r.accountId))]);
  return Promise.all(
    rows.map(async (r) => ({
      id: r._id.toString(),
      category: r.category,
      description: r.description,
      amount: r.amount,
      date: r.date.toISOString(),
      accountName: accounts.get(r.accountId.toString()) ?? "",
      createdByName: users.get(r.createdBy.toString()) ?? "",
      photoUrl: await photoViewUrl(r.receiptPhotoKey),
    })),
  );
}

export async function createExpense(input: unknown): Promise<string> {
  const actor = await requirePermission("expenses.manage");
  const values = expenseFormSchema.parse(input);
  await activeAccountOrThrow(values.accountId);
  await assertBalanceCovers(values.accountId, values.amount);
  const date = parseDateKey(values.date);
  if (!date) throw new AppError("invalidInput");

  const expense = await Expense.create({
    category: values.category,
    description: values.description,
    amount: values.amount,
    date,
    accountId: new Types.ObjectId(values.accountId),
    receiptPhotoKey: values.receiptPhotoKey,
    createdBy: new Types.ObjectId(actor.id),
  });
  await logActivity({
    actorId: actor.id,
    action: "expense.created",
    entity: "Expense",
    entityId: expense._id,
    meta: { category: values.category, amount: values.amount, accountId: values.accountId },
  });
  return expense._id.toString();
}

// ---------------------------------------------------------------------------
// Transfers between the fund's own accounts
// ---------------------------------------------------------------------------

export async function listTransfers(limit = 50): Promise<TransferItem[]> {
  await requirePermission("transfers.manage");
  const rows = await Transfer.find().sort({ date: -1, createdAt: -1 }).limit(limit).lean();
  const [users, accounts] = await Promise.all([
    names("user", rows.map((r) => r.createdBy)),
    names("account", rows.flatMap((r) => [r.fromAccountId, r.toAccountId])),
  ]);
  return rows.map((r) => ({
    id: r._id.toString(),
    fromAccountName: accounts.get(r.fromAccountId.toString()) ?? "",
    toAccountName: accounts.get(r.toAccountId.toString()) ?? "",
    amount: r.amount,
    date: r.date.toISOString(),
    note: r.note,
    createdByName: users.get(r.createdBy.toString()) ?? "",
  }));
}

/** Moves money from one account to another, e.g. cash deposited into the bank. */
export async function createTransfer(input: unknown): Promise<string> {
  const actor = await requirePermission("transfers.manage");
  const values = transferFormSchema.parse(input);
  await activeAccountOrThrow(values.fromAccountId);
  await activeAccountOrThrow(values.toAccountId);
  await assertBalanceCovers(values.fromAccountId, values.amount);
  const date = parseDateKey(values.date);
  if (!date) throw new AppError("invalidInput");

  const transfer = await Transfer.create({
    fromAccountId: new Types.ObjectId(values.fromAccountId),
    toAccountId: new Types.ObjectId(values.toAccountId),
    amount: values.amount,
    date,
    note: values.note,
    createdBy: new Types.ObjectId(actor.id),
  });
  await logActivity({
    actorId: actor.id,
    action: "transfer.created",
    entity: "Transfer",
    entityId: transfer._id,
    meta: { fromAccountId: values.fromAccountId, toAccountId: values.toAccountId, amount: values.amount },
  });
  return transfer._id.toString();
}
