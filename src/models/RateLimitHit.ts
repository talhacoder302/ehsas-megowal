import { Schema, model, models, type Model } from "mongoose";

/** Hits older than this are deleted by MongoDB (TTL index); no window may be longer. */
export const RATE_LIMIT_MAX_WINDOW_SECONDS = 24 * 60 * 60;

// One document per limited action (photo upload, Excel import, report email,
// backup download). Counted per key over a time window; no cron job needed.
type RateLimitHitDoc = { key: string; createdAt: Date };

const rateLimitHitSchema = new Schema<RateLimitHitDoc>(
  {
    key: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now, expires: RATE_LIMIT_MAX_WINDOW_SECONDS },
  },
  { collection: "rate_limit_hits", versionKey: false },
);

rateLimitHitSchema.index({ key: 1, createdAt: -1 });

export const RateLimitHit: Model<RateLimitHitDoc> =
  (models.RateLimitHit as Model<RateLimitHitDoc> | undefined) ?? model<RateLimitHitDoc>("RateLimitHit", rateLimitHitSchema);
