import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { APPROVAL_STATUSES } from "@/lib/payouts";

// Money paid out on an aid case. Never deleted. A pending disbursement does
// not reduce the account until a second head approves it; a rejected one never does.
const disbursementSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "AidCase", required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" },
    },
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    // The head who paid it (and entered it).
    paidBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Who took the money: the beneficiary, guardian, shopkeeper, hospital…
    receivedByName: { type: String, required: true, trim: true },
    // R2 object key (not a URL); see src/server/storage.ts.
    receiptPhotoKey: { type: String, default: null },
    note: { type: String, trim: true, default: "" },
    approvalStatus: { type: String, required: true, enum: APPROVAL_STATUSES, default: "not_required" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true, collection: "disbursements" },
);

disbursementSchema.index({ caseId: 1, date: 1 });
disbursementSchema.index({ approvalStatus: 1, createdAt: 1 });
disbursementSchema.index({ accountId: 1, approvalStatus: 1 });

export type DisbursementDoc = InferSchemaType<typeof disbursementSchema> & { _id: Types.ObjectId };

export const Disbursement: Model<DisbursementDoc> =
  (models.Disbursement as Model<DisbursementDoc> | undefined) ?? model<DisbursementDoc>("Disbursement", disbursementSchema);
