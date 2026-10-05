import "server-only";
import { Types } from "mongoose";
import { currentMonth } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { monthKeySchema, reasonFormSchema } from "@/lib/validators";
import { ContributionBill } from "@/models";
import { logActivity } from "./activity-log";
import { createBillsForMonth, type BillRunResult } from "./contributions-core";

/**
 * "Generate bills for month": one bill per billable member at that month's
 * rate. Idempotent, so pressing it twice creates nothing the second time.
 */
export async function generateBills(input: unknown): Promise<BillRunResult> {
  const actor = await requirePermission("bills.manage");
  const month = monthKeySchema.parse(input);
  if (month > currentMonth()) throw new AppError("monthInFuture");

  const result = await createBillsForMonth(month, actor.id);
  await logActivity({
    actorId: actor.id,
    action: "bills.generated",
    entity: "ContributionBill",
    meta: { ...result },
  });
  return result;
}

/** Waives an unpaid bill for a special situation. The reason is kept on the bill. */
export async function waiveBill(billId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("bills.manage");
  const { reason } = reasonFormSchema.parse(input);
  if (!Types.ObjectId.isValid(billId)) throw new AppError("notFound");

  const bill = await ContributionBill.findById(billId).lean();
  if (!bill) throw new AppError("notFound");
  if (bill.status === "waived") throw new AppError("billAlreadyWaived");
  if (bill.paidAmount > 0) throw new AppError("billHasPayments");

  const result = await ContributionBill.updateOne(
    { _id: bill._id, status: "unpaid", paidAmount: 0 },
    {
      $set: {
        status: "waived",
        waivedReason: reason,
        waivedBy: new Types.ObjectId(actor.id),
        waivedAt: new Date(),
      },
    },
  );
  if (result.modifiedCount === 0) throw new AppError("billHasPayments");

  await logActivity({
    actorId: actor.id,
    action: "bill.waived",
    entity: "ContributionBill",
    entityId: bill._id,
    meta: { memberId: bill.memberId.toString(), month: bill.month, amount: bill.amount, reason },
  });
}
