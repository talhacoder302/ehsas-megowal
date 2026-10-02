import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const MEMBER_STATUSES = ["active", "left", "deceased", "exempt"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

const memberSchema = new Schema(
  {
    // Sequential, e.g. EP-001.
    memberNo: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    mohalla: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    joinDate: { type: Date, required: true },
    status: { type: String, required: true, enum: MEMBER_STATUSES, default: "active" },
    statusChangedAt: { type: Date, default: null },
    statusReason: { type: String, trim: true, default: "" },
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
