import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const activityLogSchema = new Schema(
  {
    // null for system actions (seed, scripts).
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "activity_logs" },
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
// A member's Activity tab also finds payments and waived bills through meta.memberId.
activityLogSchema.index({ "meta.memberId": 1, createdAt: -1 }, { partialFilterExpression: { "meta.memberId": { $exists: true } } });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema> & { _id: Types.ObjectId };

export const ActivityLog: Model<ActivityLogDoc> =
  (models.ActivityLog as Model<ActivityLogDoc> | undefined) ??
  model<ActivityLogDoc>("ActivityLog", activityLogSchema);
