import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { ACCOUNT_TYPES } from "@/lib/contributions";

// Where the money is kept: cash with a head, a bank account or a mobile wallet.
// The balance is openingBalance plus income minus spending (computed, never stored).
const accountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ACCOUNT_TYPES },
    // The person who keeps this money (usually a head).
    holderUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    openingBalance: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" },
    },
    active: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "accounts" },
);

accountSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export type AccountDoc = InferSchemaType<typeof accountSchema> & { _id: Types.ObjectId };

export const Account: Model<AccountDoc> =
  (models.Account as Model<AccountDoc> | undefined) ?? model<AccountDoc>("Account", accountSchema);
