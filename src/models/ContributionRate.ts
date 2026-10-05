import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { MONTH_PATTERN } from "@/lib/dates";

// The rate for a month is the latest rate whose effectiveFrom <= that month
// (rateForMonth in src/lib/contributions.ts). Bills keep the amount they were
// made with, so adding a rate never changes existing bills.
const contributionRateSchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: "{PATH} must be whole rupees" },
    },
    effectiveFrom: { type: String, required: true, unique: true, match: MONTH_PATTERN },
    note: { type: String, trim: true, default: "" },
    // null for seed/system rows.
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "contribution_rates" },
);

export type ContributionRateDoc = InferSchemaType<typeof contributionRateSchema> & { _id: Types.ObjectId };

export const ContributionRate: Model<ContributionRateDoc> =
  (models.ContributionRate as Model<ContributionRateDoc> | undefined) ??
  model<ContributionRateDoc>("ContributionRate", contributionRateSchema);
