import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { locales } from "@/i18n/config";
import { ROLES } from "@/lib/roles";

export const USER_STATUSES = ["active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, match: /^03\d{9}$/ },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ROLES },
    // Set for members, and for heads/admin who are also members.
    memberId: { type: Schema.Types.ObjectId, ref: "Member", default: null },
    language: { type: String, required: true, enum: locales, default: "en" },
    status: { type: String, required: true, enum: USER_STATUSES, default: "active" },
    mustChangePassword: { type: Boolean, required: true, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" },
);

// One user per member record.
userSchema.index({ memberId: 1 }, { unique: true, partialFilterExpression: { memberId: { $type: "objectId" } } });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc> | undefined) ?? model<UserDoc>("User", userSchema);
