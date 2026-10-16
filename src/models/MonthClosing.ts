import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { CLOSING_STATUSES } from "@/lib/closing";
import { MONTH_PATTERN } from "@/lib/dates";

const wholeRupees = { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" };
const rupees = { type: Number, required: true, validate: wholeRupees };

// Balance of each account at month end, as it was when the month was closed.
const accountBalanceSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    name: { type: String, required: true },
    balance: rupees,
  },
  { _id: false },
);

// Each time the admin reopens the month, the figures it had are kept here.
const reopeningSchema = new Schema(
  {
    reason: { type: String, required: true, trim: true },
    reopenedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reopenedAt: { type: Date, required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, required: true },
    closingBalance: rupees,
    freeBalance: rupees,
  },
  { _id: false },
);

// The books of one month, saved when the heads close it. A closed month is
// locked: nothing dated in it (or earlier) can be added or cancelled until the
// admin reopens it. Reopening keeps the document with status "reopened";
// closing again overwrites the figures.
const monthClosingSchema = new Schema(
  {
    month: { type: String, required: true, unique: true, match: MONTH_PATTERN },
    status: { type: String, required: true, enum: CLOSING_STATUSES, default: "closed" },
    openingBalance: rupees,
    totalIncome: rupees,
    totalDisbursed: rupees,
    totalExpenses: rupees,
    closingBalance: rupees,
    committedAmount: rupees,
    emergencyReserve: rupees,
    freeBalance: rupees,
    accountBalances: { type: [accountBalanceSchema], default: [] },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, required: true },
    reopenings: { type: [reopeningSchema], default: [] },
  },
  { timestamps: true, collection: "month_closings" },
);

monthClosingSchema.index({ status: 1, month: -1 });

export type MonthClosingDoc = InferSchemaType<typeof monthClosingSchema> & { _id: Types.ObjectId };

export const MonthClosing: Model<MonthClosingDoc> =
  (models.MonthClosing as Model<MonthClosingDoc> | undefined) ?? model<MonthClosingDoc>("MonthClosing", monthClosingSchema);
