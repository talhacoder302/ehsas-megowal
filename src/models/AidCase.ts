import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { CASE_CATEGORIES, CASE_STATUSES } from "@/lib/cases";

const wholeRupees = { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" };

// One row per status change, oldest first. The first row is the case being
// registered (reason may be empty); every later change needs a reason.
const statusChangeSchema = new Schema(
  {
    status: { type: String, required: true, enum: CASE_STATUSES },
    reason: { type: String, trim: true, default: "" },
    // Set when the change approved an amount.
    approvedAmount: { type: Number, default: null, validate: { validator: (v: number | null) => v === null || Number.isSafeInteger(v) } },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const noteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

// An aid case: a family in need, from request to completion. Beneficiary
// name, guardian, contact, mohalla and description are private: members only
// see them when showNameToMembers is true (see redactCase in src/lib/cases.ts).
const aidCaseSchema = new Schema(
  {
    // Settings.caseNoPrefix + sequence, e.g. C-0014.
    caseNo: { type: String, required: true, unique: true },
    category: { type: String, required: true, enum: CASE_CATEGORIES },
    beneficiaryName: { type: String, required: true, trim: true },
    guardianName: { type: String, trim: true, default: "" },
    mohalla: { type: String, trim: true, default: "" },
    contactMobile: { type: String, trim: true, default: "" },
    recommendedBy: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    estimatedAmount: { type: Number, required: true, min: 0, validate: wholeRupees },
    // null until the case is approved.
    approvedAmount: { type: Number, default: null, min: 0, validate: { validator: (v: number | null) => v === null || Number.isSafeInteger(v) } },
    expectedDate: { type: Date, default: null },
    status: { type: String, required: true, enum: CASE_STATUSES, default: "requested" },
    statusHistory: { type: [statusChangeSchema], default: [] },
    notes: { type: [noteSchema], default: [] },
    showNameToMembers: { type: Boolean, required: true, default: false },
    // Last status change or note; used to highlight cases nobody has updated.
    lastUpdateAt: { type: Date, required: true, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "aid_cases" },
);

aidCaseSchema.index({ status: 1, lastUpdateAt: 1 });
aidCaseSchema.index({ createdAt: -1 });

export type AidCaseDoc = InferSchemaType<typeof aidCaseSchema> & { _id: Types.ObjectId };

export const AidCase: Model<AidCaseDoc> =
  (models.AidCase as Model<AidCaseDoc> | undefined) ?? model<AidCaseDoc>("AidCase", aidCaseSchema);
