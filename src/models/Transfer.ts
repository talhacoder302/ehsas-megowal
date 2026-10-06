import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

// Money moved between the fund's own accounts, e.g. cash deposited into the bank.
const transferSchema = new Schema(
  {
    fromAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    toAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" },
    },
    date: { type: Date, required: true },
    note: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "transfers" },
);

transferSchema.index({ date: -1, createdAt: -1 });
transferSchema.index({ fromAccountId: 1 });
transferSchema.index({ toAccountId: 1 });

export type TransferDoc = InferSchemaType<typeof transferSchema> & { _id: Types.ObjectId };

export const Transfer: Model<TransferDoc> =
  (models.Transfer as Model<TransferDoc> | undefined) ?? model<TransferDoc>("Transfer", transferSchema);
