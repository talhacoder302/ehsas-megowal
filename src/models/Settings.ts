import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const wholeRupees = {
  validator: Number.isSafeInteger,
  message: "{PATH} must be whole rupees",
};

export const DEFAULT_MEMBER_NO_PREFIX = "EP-";

// Singleton document (key = "main") with program-wide settings.
const settingsSchema = new Schema(
  {
    key: { type: String, required: true, default: "main", unique: true, immutable: true },
    programName: { type: String, required: true, trim: true, default: "Ehsas Program" },
    villageName: { type: String, required: true, trim: true, default: "Megowal" },
    memberNoPrefix: { type: String, required: true, trim: true, default: DEFAULT_MEMBER_NO_PREFIX },
    receiptPrefix: { type: String, required: true, trim: true, default: "R-" },
    caseNoPrefix: { type: String, required: true, trim: true, default: "C-" },
    emergencyReserveAmount: { type: Number, required: true, min: 0, default: 0, validate: wholeRupees },
    secondHeadApprovalEnabled: { type: Boolean, required: true, default: false },
    secondHeadApprovalLimit: { type: Number, required: true, min: 0, default: 0, validate: wholeRupees },
    showBeneficiaryNamesDefault: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: "settings" },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc> | undefined) ?? model<SettingsDoc>("Settings", settingsSchema);
