import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { INCOME_SOURCES, PAYMENT_METHODS } from "@/lib/contributions";
import { MONTH_PATTERN } from "@/lib/dates";

const wholeRupees = { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" };

// How a payment was split, so a cancellation can reverse exactly what it did.
const allocationSchema = new Schema(
  {
    billId: { type: Schema.Types.ObjectId, ref: "ContributionBill", required: true },
    month: { type: String, required: true, match: MONTH_PATTERN },
    amount: { type: Number, required: true, min: 1, validate: wholeRupees },
  },
  { _id: false },
);

// Money received. Never deleted: a cancelled payment stays with cancelled = true.
const incomeSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", default: null },
    source: { type: String, required: true, enum: INCOME_SOURCES },
    amount: { type: Number, required: true, min: 1, validate: wholeRupees },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    billIds: { type: [Schema.Types.ObjectId], ref: "ContributionBill", default: [] },
    monthsCovered: { type: [String], default: [] },
    allocations: { type: [allocationSchema], default: [] },
    // Part of the payment that cleared the member's opening due from the paper register.
    openingDuePaid: { type: Number, required: true, min: 0, default: 0, validate: wholeRupees },
    method: { type: String, required: true, enum: PAYMENT_METHODS },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Settings.receiptPrefix + sequence, e.g. R-0001.
    receiptNumber: { type: String, required: true, unique: true },
    // Random, unguessable id for the public receipt link shared on WhatsApp.
    publicToken: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    note: { type: String, trim: true, default: "" },
    cancelled: { type: Boolean, required: true, default: false },
    cancelReason: { type: String, trim: true, default: "" },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "incomes" },
);

incomeSchema.index({ date: -1, createdAt: -1 });
incomeSchema.index({ memberId: 1, date: 1 });
incomeSchema.index({ accountId: 1, cancelled: 1 });

export type IncomeDoc = InferSchemaType<typeof incomeSchema> & { _id: Types.ObjectId };

export const Income: Model<IncomeDoc> =
  (models.Income as Model<IncomeDoc> | undefined) ?? model<IncomeDoc>("Income", incomeSchema);
