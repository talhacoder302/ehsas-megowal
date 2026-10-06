import "server-only";
import { Types } from "mongoose";
import { canCancelPayment, totalDueNow, type PayableItem, type PaymentMethod } from "@/lib/contributions";
import { currentMonth, parseDateKey, type MonthKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { paymentFormSchema, reasonFormSchema } from "@/lib/validators";
import { Account, Income, Member, User, type IncomeDoc } from "@/models";
import { assertBalanceCovers, listAccountOptions, type AccountOption } from "./accounts";
import { logActivity } from "./activity-log";
import { applyPayment, cancelIncome, memberPayables, type PayableMember } from "./contributions-core";
import { readSettings } from "./settings";

export type PaymentContext = {
  member: PayableMember;
  /** In the order money is applied: opening due, oldest months, then advance. */
  items: PayableItem[];
  totalDueNow: number;
  accounts: AccountOption[];
  defaultAccountId: string | null;
  currentMonth: MonthKey;
};

export type PaymentListItem = {
  id: string;
  receiptNumber: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  memberId: string | null;
  memberNo: string;
  memberName: string;
  monthsCovered: MonthKey[];
  openingDuePaid: number;
  accountName: string;
  receivedByName: string;
  cancelled: boolean;
};

export type ReceiptLine = { month: MonthKey | null; amount: number };

export type ReceiptView = {
  id: string;
  receiptNumber: string;
  publicToken: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  /** Opening due first (month null), then each month. */
  lines: ReceiptLine[];
  monthsCovered: MonthKey[];
  openingDuePaid: number;
  member: { id: string | null; memberNo: string; name: string; fatherName: string };
  receivedByName: string;
  note: string;
  cancelled: boolean;
  cancelReason: string;
  cancelledAt: string | null;
  cancelledByName: string | null;
  programName: string;
  villageName: string;
};

export type StaffReceiptView = ReceiptView & {
  memberMobile: string;
  accountName: string;
  canCancel: boolean;
};

// ---------------------------------------------------------------------------
// Receiving money
// ---------------------------------------------------------------------------

/** What the payment screen needs for one member. null if the member does not exist. */
export async function getPaymentContext(memberId: string): Promise<PaymentContext | null> {
  const me = await requirePermission("payments.record");
  const [payables, accounts] = await Promise.all([memberPayables(memberId), listAccountOptions()]);
  if (!payables) return null;
  const mine = accounts.find((a) => a.holderUserId === me.id);
  return {
    member: payables.member,
    items: payables.items,
    totalDueNow: totalDueNow(payables.items),
    accounts,
    defaultAccountId: mine?.id ?? accounts[0]?.id ?? null,
    currentMonth: currentMonth(),
  };
}

export async function receivePayment(input: unknown): Promise<{ id: string; receiptNumber: string }> {
  const actor = await requirePermission("payments.record");
  const values = paymentFormSchema.parse(input);
  const date = parseDateKey(values.date);
  if (!date) throw new AppError("invalidInput");

  const payment = await applyPayment({
    memberId: values.memberId,
    amount: values.amount,
    accountId: values.accountId,
    method: values.method,
    date,
    note: values.note,
    receivedBy: actor.id,
  });

  await logActivity({
    actorId: actor.id,
    action: "payment.received",
    entity: "Income",
    entityId: payment.id,
    meta: {
      memberId: values.memberId,
      receiptNumber: payment.receiptNumber,
      amount: values.amount,
      months: payment.monthsCovered,
      openingDuePaid: payment.openingDuePaid,
      accountId: values.accountId,
      method: values.method,
    },
  });
  return { id: payment.id, receiptNumber: payment.receiptNumber };
}

/** Admin, or the head who did not receive it. The record stays, marked cancelled. */
export async function cancelPayment(incomeId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("payments.cancel");
  const { reason } = reasonFormSchema.parse(input);
  if (!Types.ObjectId.isValid(incomeId)) throw new AppError("notFound");

  const income = await Income.findById(incomeId).select("receivedBy cancelled accountId amount").lean();
  if (!income) throw new AppError("notFound");
  if (income.cancelled) throw new AppError("alreadyCancelled");
  if (!canCancelPayment(actor, { receivedBy: income.receivedBy.toString(), cancelled: income.cancelled })) {
    throw new AppError("cannotCancelOwnPayment");
  }
  // Cancelling takes the money back out of the account; it must still be there.
  await assertBalanceCovers(income.accountId.toString(), income.amount);

  const cancelled = await cancelIncome(incomeId, actor.id, reason);
  if (!cancelled) throw new AppError("alreadyCancelled");

  await logActivity({
    actorId: actor.id,
    action: "payment.cancelled",
    entity: "Income",
    entityId: cancelled._id,
    meta: {
      memberId: cancelled.memberId ? cancelled.memberId.toString() : null,
      receiptNumber: cancelled.receiptNumber,
      amount: cancelled.amount,
      months: cancelled.monthsCovered,
      reason,
    },
  });
}

// ---------------------------------------------------------------------------
// Lists and receipts
// ---------------------------------------------------------------------------

async function namesById<T extends { _id: Types.ObjectId }>(
  ids: (Types.ObjectId | null | undefined)[],
  find: (ids: Types.ObjectId[]) => Promise<T[]>,
  pick: (row: T) => string,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map(String))].map(
    (id) => new Types.ObjectId(id),
  );
  if (unique.length === 0) return new Map();
  const rows = await find(unique);
  return new Map(rows.map((r) => [r._id.toString(), pick(r)]));
}

/** Recent payments, newest first. */
export async function listPayments(limit = 300): Promise<PaymentListItem[]> {
  await requirePermission("payments.record");
  const incomes = await Income.find().sort({ date: -1, createdAt: -1 }).limit(limit).lean();

  const memberIds = incomes.map((i) => i.memberId).filter((id): id is Types.ObjectId => Boolean(id));
  const [members, accounts, users] = await Promise.all([
    Member.find({ _id: { $in: memberIds } }).select("memberNo name").lean(),
    namesById(incomes.map((i) => i.accountId), (ids) => Account.find({ _id: { $in: ids } }).select("name").lean(), (a) => a.name),
    namesById(incomes.map((i) => i.receivedBy), (ids) => User.find({ _id: { $in: ids } }).select("name").lean(), (u) => u.name),
  ]);
  const memberMap = new Map(members.map((m) => [m._id.toString(), m]));

  return incomes.map((i) => {
    const member = i.memberId ? memberMap.get(i.memberId.toString()) : undefined;
    return {
      id: i._id.toString(),
      receiptNumber: i.receiptNumber,
      date: i.date.toISOString(),
      amount: i.amount,
      method: i.method,
      memberId: i.memberId ? i.memberId.toString() : null,
      memberNo: member?.memberNo ?? "",
      memberName: member?.name ?? "",
      monthsCovered: i.monthsCovered,
      openingDuePaid: i.openingDuePaid,
      accountName: accounts.get(i.accountId.toString()) ?? "",
      receivedByName: users.get(i.receivedBy.toString()) ?? "",
      cancelled: i.cancelled,
    };
  });
}

async function toReceiptView(income: IncomeDoc): Promise<ReceiptView & { memberMobile: string; accountName: string }> {
  const [member, users, account, settings] = await Promise.all([
    income.memberId ? Member.findById(income.memberId).select("memberNo name fatherName mobile").lean() : null,
    namesById(
      [income.receivedBy, income.cancelledBy],
      (ids) => User.find({ _id: { $in: ids } }).select("name").lean(),
      (u) => u.name,
    ),
    Account.findById(income.accountId).select("name").lean(),
    readSettings(),
  ]);

  const lines: ReceiptLine[] = [];
  if (income.openingDuePaid > 0) lines.push({ month: null, amount: income.openingDuePaid });
  for (const a of income.allocations) lines.push({ month: a.month, amount: a.amount });

  return {
    id: income._id.toString(),
    receiptNumber: income.receiptNumber,
    publicToken: income.publicToken,
    date: income.date.toISOString(),
    amount: income.amount,
    method: income.method,
    lines,
    monthsCovered: income.monthsCovered,
    openingDuePaid: income.openingDuePaid,
    member: {
      id: member ? member._id.toString() : null,
      memberNo: member?.memberNo ?? "",
      name: member?.name ?? "",
      fatherName: member?.fatherName ?? "",
    },
    receivedByName: users.get(income.receivedBy.toString()) ?? "",
    note: income.note,
    cancelled: income.cancelled,
    cancelReason: income.cancelReason,
    cancelledAt: income.cancelledAt ? income.cancelledAt.toISOString() : null,
    cancelledByName: income.cancelledBy ? (users.get(income.cancelledBy.toString()) ?? null) : null,
    programName: settings.programName,
    villageName: settings.villageName,
    memberMobile: member?.mobile ?? "",
    accountName: account?.name ?? "",
  };
}

/** Full receipt for staff, with what they may do with it. */
export async function getReceipt(incomeId: string): Promise<StaffReceiptView | null> {
  const me = await requirePermission("payments.record");
  if (!Types.ObjectId.isValid(incomeId)) return null;
  const income = await Income.findById(incomeId).lean();
  if (!income) return null;
  const view = await toReceiptView(income);
  return {
    ...view,
    canCancel: canCancelPayment(me, { receivedBy: income.receivedBy.toString(), cancelled: income.cancelled }),
  };
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/**
 * PUBLIC on purpose: the receipt link sent on WhatsApp opens without a login.
 * The token is random (128 bits) and the view leaves out the member's mobile,
 * the account and anything else not printed on a paper receipt.
 */
export async function getReceiptByToken(token: string): Promise<ReceiptView | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  await connectDB();
  const income = await Income.findOne({ publicToken: token }).lean();
  if (!income) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { memberMobile, accountName, ...view } = await toReceiptView(income);
  return view;
}
