import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { BILL_STATUSES } from "@/lib/contributions";
import { MONTH_PATTERN } from "@/lib/dates";

const wholeRupees = { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" };

export const BILL_ORIGINS = ["generated", "payment", "seed"] as const;

// One bill per member per month. The unique index makes bill generation
// idempotent: generating again (or paying in advance) never adds a second bill.
const contributionBillSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    month: { type: String, required: true, match: MONTH_PATTERN },
    amount: { type: Number, required: true, min: 0, validate: wholeRupees },
    paidAmount: { type: Number, required: true, min: 0, default: 0, validate: wholeRupees },
    status: { type: String, required: true, enum: BILL_STATUSES, default: "unpaid" },
    // "generated" by the monthly button, "payment" when made by an advance payment.
    origin: { type: String, required: true, enum: BILL_ORIGINS, default: "generated" },
    waivedReason: { type: String, trim: true, default: "" },
    waivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    waivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "contribution_bills" },
);

contributionBillSchema.index({ memberId: 1, month: 1 }, { unique: true });
contributionBillSchema.index({ month: 1, status: 1 });
contributionBillSchema.index({ status: 1, month: 1 });

export type ContributionBillDoc = InferSchemaType<typeof contributionBillSchema> & { _id: Types.ObjectId };

export const ContributionBill: Model<ContributionBillDoc> =
  (models.ContributionBill as Model<ContributionBillDoc> | undefined) ??
  model<ContributionBillDoc>("ContributionBill", contributionBillSchema);
