import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const wholeRupees = { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" };

// A head counts the money actually in an account and compares it with what
// the app says should be there. Kept as history; never changes the balance.
const cashCountSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    date: { type: Date, required: true, default: Date.now },
    systemBalance: { type: Number, required: true, validate: wholeRupees },
    countedAmount: { type: Number, required: true, min: 0, validate: wholeRupees },
    // countedAmount − systemBalance: below zero is money missing.
    difference: { type: Number, required: true, validate: wholeRupees },
    // Required when the difference is not zero.
    note: { type: String, trim: true, default: "" },
    countedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "cash_counts" },
);

cashCountSchema.index({ date: -1 });
cashCountSchema.index({ accountId: 1, date: -1 });

export type CashCountDoc = InferSchemaType<typeof cashCountSchema> & { _id: Types.ObjectId };

export const CashCount: Model<CashCountDoc> =
  (models.CashCount as Model<CashCountDoc> | undefined) ?? model<CashCountDoc>("CashCount", cashCountSchema);
