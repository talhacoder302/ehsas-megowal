import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { MEMBER_STATUSES } from "@/lib/member-status";

export { MEMBER_STATUSES, type MemberStatus } from "@/lib/member-status";

// One row per status change, oldest first. Billing reads this through
// isBillableMonth() in src/lib/member-status.ts.
const statusChangeSchema = new Schema(
  {
    status: { type: String, required: true, enum: MEMBER_STATUSES },
    reason: { type: String, required: true, trim: true },
    // The day the change took effect (midnight Pakistan time).
    date: { type: Date, required: true },
    // null for seed/system changes.
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const memberSchema = new Schema(
  {
    // Settings.memberNoPrefix + sequence, e.g. EP-001.
    memberNo: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    mohalla: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    joinDate: { type: Date, required: true },
    status: { type: String, required: true, enum: MEMBER_STATUSES, default: "active" },
    // Date and reason of the latest status change (copied from statusHistory).
    statusChangedAt: { type: Date, default: null },
    statusReason: { type: String, trim: true, default: "" },
    statusHistory: { type: [statusChangeSchema], default: [] },
    // Unpaid amount carried over from the paper register, whole rupees.
    openingDue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" },
    },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true, collection: "members" },
);

memberSchema.index({ status: 1, name: 1 });

export type MemberDoc = InferSchemaType<typeof memberSchema> & { _id: Types.ObjectId };

export const Member: Model<MemberDoc> =
  (models.Member as Model<MemberDoc> | undefined) ?? model<MemberDoc>("Member", memberSchema);
