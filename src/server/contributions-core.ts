import "server-only";
import { randomBytes } from "node:crypto";
import { mongo, Types } from "mongoose";
import {
  allocatePayment,
  buildPayableItems,
  formatReceiptNo,
  planBills,
  rateForMonth,
  unbilledMonthsFor,
  type PayableItem,
  type PaymentMethod,
  type RateLike,
} from "@/lib/contributions";
import { currentMonth, type MonthKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { MemberStatus } from "@/lib/member-status";
import { Account, ContributionBill, ContributionRate, Income, Member } from "@/models";
import { nextSequence } from "./sequence";
import { readSettings } from "./settings";

// Internal building blocks for contributions. NO session checks here: the
// services in bills.ts / payments.ts check the role first, and the seed script
// calls these directly. Never call them from a Server Action or route.

export async function loadRates(): Promise<RateLike[]> {
  await connectDB();
  const rows = await ContributionRate.find().select("amount effectiveFrom").sort({ effectiveFrom: 1 }).lean();
  return rows.map((r) => ({ amount: r.amount, effectiveFrom: r.effectiveFrom }));
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

/**
 * One upsert per member keyed on (memberId, month) that only sets fields on
 * insert. With the unique index this can run any number of times: an existing
 * bill is never duplicated or changed.
 */
export function billUpsertOps(
  memberIds: readonly string[],
  month: MonthKey,
  amount: number,
  createdBy: string | null,
  origin: "generated" | "payment" | "seed",
) {
  return memberIds.map((id) => {
    const memberId = new Types.ObjectId(id);
    return {
      updateOne: {
        filter: { memberId, month },
        update: {
          $setOnInsert: {
            memberId,
            month,
            amount,
            paidAmount: 0,
            status: "unpaid" as const,
            origin,
            createdBy: createdBy ? new Types.ObjectId(createdBy) : null,
          },
        },
        upsert: true,
      },
    };
  });
}

export type BillRunResult = {
  month: MonthKey;
  rate: number;
  created: number;
  alreadyBilled: number;
  notBillable: number;
};

/** Makes the missing bills for a month at that month's rate. Safe to run again. */
export async function createBillsForMonth(
  month: MonthKey,
  actorId: string | null,
  origin: "generated" | "seed" = "generated",
): Promise<BillRunResult> {
  const rate = rateForMonth(await loadRates(), month);
  if (rate === null) throw new AppError("noRateForMonth");

  const [members, existing] = await Promise.all([
    Member.find().select("joinDate status statusHistory").lean(),
    ContributionBill.find({ month }).select("memberId").lean(),
  ]);
  const plan = planBills(
    members.map((m) => ({ id: m._id.toString(), joinDate: m.joinDate, status: m.status, statusHistory: m.statusHistory })),
    month,
    new Set(existing.map((b) => b.memberId.toString())),
  );

  let created = 0;
  if (plan.toCreate.length > 0) {
    try {
      const result = await ContributionBill.bulkWrite(billUpsertOps(plan.toCreate, month, rate, actorId, origin), {
        ordered: false,
      });
      created = result.upsertedCount;
    } catch (error) {
      // Someone generated the same month at the same moment: their bills stand.
      if (error instanceof mongo.MongoBulkWriteError && error.code === 11000) created = error.result.upsertedCount;
      else throw error;
    }
  }
  return {
    month,
    rate,
    created,
    alreadyBilled: plan.alreadyBilled + (plan.toCreate.length - created),
    notBillable: plan.notBillable,
  };
}

/**
 * Update pipeline that adds `delta` to paidAmount and recomputes the status
 * (waived bills keep their status). Needs `{ updatePipeline: true }`.
 */
export function paidAmountPipeline(delta: number) {
  return [
    { $set: { paidAmount: { $add: ["$paidAmount", delta] } } },
    {
      $set: {
        status: {
          $cond: [
            { $eq: ["$status", "waived"] },
            "waived",
            {
              $cond: [
                { $gte: ["$paidAmount", "$amount"] },
                "paid",
                { $cond: [{ $gt: ["$paidAmount", 0] }, "partial", "unpaid"] },
              ],
            },
          ],
        },
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// What a member can pay
// ---------------------------------------------------------------------------

export type PayableMember = {
  id: string;
  memberNo: string;
  name: string;
  fatherName: string;
  mobile: string;
  status: MemberStatus;
  openingDue: number;
};

export async function memberPayables(memberId: string): Promise<{ member: PayableMember; items: PayableItem[] } | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(memberId)) return null;
  const member = await Member.findById(memberId)
    .select("memberNo name fatherName mobile status statusHistory joinDate openingDue")
    .lean();
  if (!member) return null;

  const [bills, rates] = await Promise.all([
    ContributionBill.find({ memberId: member._id }).select("month amount paidAmount status").lean(),
    loadRates(),
  ]);
  const month = currentMonth();
  const lastBilledMonth = bills.reduce<MonthKey | null>((max, b) => (max === null || b.month > max ? b.month : max), null);

  const items = buildPayableItems({
    openingDue: member.openingDue,
    bills: bills.map((b) => ({ id: b._id.toString(), month: b.month, amount: b.amount, paidAmount: b.paidAmount, status: b.status })),
    unbilledMonths: unbilledMonthsFor({ member, lastBilledMonth, rates, currentMonth: month }),
    currentMonth: month,
  });

  return {
    member: {
      id: member._id.toString(),
      memberNo: member.memberNo,
      name: member.name,
      fatherName: member.fatherName,
      mobile: member.mobile,
      status: member.status,
      openingDue: member.openingDue,
    },
    items,
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type ApplyPaymentInput = {
  memberId: string;
  amount: number;
  accountId: string;
  method: PaymentMethod;
  date: Date;
  note: string;
  receivedBy: string;
};

export type AppliedPayment = {
  id: string;
  receiptNumber: string;
  publicToken: string;
  monthsCovered: MonthKey[];
  openingDuePaid: number;
};

/**
 * Records a member's payment. Money goes to the opening due first, then the
 * oldest unpaid bills, then future months (bills for those are made on the
 * spot). Each step is a conditional update; if any step fails, the steps
 * already done are reversed so nothing is half-applied.
 */
export async function applyPayment(input: ApplyPaymentInput): Promise<AppliedPayment> {
  const payables = await memberPayables(input.memberId);
  if (!payables) throw new AppError("memberNotFound");
  const account = await Account.findOne({ _id: input.accountId, active: true }).select("_id").lean();
  if (!account) throw new AppError("accountNotFound");

  const { lines, leftover } = allocatePayment(payables.items, input.amount);
  if (leftover > 0 || lines.length === 0) throw new AppError("amountTooMuch");

  const memberId = new Types.ObjectId(input.memberId);
  const receivedBy = new Types.ObjectId(input.receivedBy);
  const applied: { billId: Types.ObjectId; month: MonthKey; amount: number }[] = [];
  let openingDuePaid = 0;

  try {
    for (const line of lines) {
      if (line.item.kind === "opening" || !line.item.month) {
        const result = await Member.updateOne(
          { _id: memberId, openingDue: { $gte: line.amount } },
          { $inc: { openingDue: -line.amount } },
        );
        if (result.modifiedCount === 0) throw new AppError("paymentConflict");
        openingDuePaid = line.amount;
        continue;
      }

      const month = line.item.month;
      let billId = line.item.billId ? new Types.ObjectId(line.item.billId) : null;
      if (!billId) {
        const bill = await ContributionBill.findOneAndUpdate(
          { memberId, month },
          {
            $setOnInsert: {
              memberId,
              month,
              amount: line.item.due,
              paidAmount: 0,
              status: "unpaid",
              origin: "payment",
              createdBy: receivedBy,
            },
          },
          { upsert: true, returnDocument: "after" },
        )
          .select("_id")
          .lean();
        if (!bill) throw new AppError("paymentConflict");
        billId = bill._id;
      }

      const result = await ContributionBill.updateOne(
        {
          _id: billId,
          status: { $ne: "waived" },
          $expr: { $lte: [{ $add: ["$paidAmount", line.amount] }, "$amount"] },
        },
        paidAmountPipeline(line.amount),
        { updatePipeline: true },
      );
      if (result.modifiedCount === 0) throw new AppError("paymentConflict");
      applied.push({ billId, month, amount: line.amount });
    }

    const settings = await readSettings();
    const receiptNumber = formatReceiptNo(await nextSequence("receipt"), settings.receiptPrefix);
    const publicToken = randomBytes(16).toString("base64url");
    const monthsCovered = applied.map((a) => a.month);

    const income = await Income.create({
      memberId,
      source: "member_contribution",
      amount: input.amount,
      accountId: new Types.ObjectId(input.accountId),
      billIds: applied.map((a) => a.billId),
      monthsCovered,
      allocations: applied,
      openingDuePaid,
      method: input.method,
      receivedBy,
      receiptNumber,
      publicToken,
      date: input.date,
      note: input.note,
    });
    return { id: income._id.toString(), receiptNumber, publicToken, monthsCovered, openingDuePaid };
  } catch (error) {
    await reverseAllocations(memberId, applied, openingDuePaid);
    throw error;
  }
}

async function reverseAllocations(
  memberId: Types.ObjectId,
  allocations: readonly { billId: Types.ObjectId; amount: number }[],
  openingDuePaid: number,
) {
  for (const a of allocations) {
    await ContributionBill.updateOne(
      { _id: a.billId, paidAmount: { $gte: a.amount } },
      paidAmountPipeline(-a.amount),
      { updatePipeline: true },
    );
  }
  if (openingDuePaid > 0) await Member.updateOne({ _id: memberId }, { $inc: { openingDue: openingDuePaid } });
}

/**
 * Marks a payment cancelled (it is never deleted) and gives back what it paid:
 * bill amounts and the opening due. Returns null if it was already cancelled.
 */
export async function cancelIncome(incomeId: string, actorId: string, reason: string) {
  const income = await Income.findOneAndUpdate(
    { _id: incomeId, cancelled: false },
    {
      $set: {
        cancelled: true,
        cancelReason: reason,
        cancelledBy: new Types.ObjectId(actorId),
        cancelledAt: new Date(),
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!income) return null;
  if (income.memberId) await reverseAllocations(income.memberId, income.allocations, income.openingDuePaid);
  return income;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/** Unpaid bill amounts up to `month` for each member, or one member (opening due not included). */
export async function billDuesByMember(
  month: MonthKey,
  memberId?: Types.ObjectId,
): Promise<Map<string, { due: number; months: { month: MonthKey; due: number }[] }>> {
  const bills = await ContributionBill.find({
    status: { $in: ["unpaid", "partial"] },
    month: { $lte: month },
    ...(memberId ? { memberId } : {}),
  })
    .select("memberId month amount paidAmount")
    .sort({ month: 1 })
    .lean();
  const out = new Map<string, { due: number; months: { month: MonthKey; due: number }[] }>();
  for (const b of bills) {
    const key = b.memberId.toString();
    const entry = out.get(key) ?? { due: 0, months: [] };
    const due = b.amount - b.paidAmount;
    entry.due += due;
    entry.months.push({ month: b.month, due });
    out.set(key, entry);
  }
  return out;
}
