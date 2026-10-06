import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { EXPENSE_CATEGORIES } from "@/lib/payouts";

// General program costs not tied to a case (stationery, printing, transport).
const expenseSchema = new Schema(
  {
    category: { type: String, required: true, enum: EXPENSE_CATEGORIES },
    description: { type: String, required: true, trim: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" },
    },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    // R2 object key (not a URL); see src/server/storage.ts.
    receiptPhotoKey: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "expenses" },
);

expenseSchema.index({ date: -1, createdAt: -1 });
expenseSchema.index({ accountId: 1 });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & { _id: Types.ObjectId };

export const Expense: Model<ExpenseDoc> =
  (models.Expense as Model<ExpenseDoc> | undefined) ?? model<ExpenseDoc>("Expense", expenseSchema);
