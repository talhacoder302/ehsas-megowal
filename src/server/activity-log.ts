import "server-only";
import { Types } from "mongoose";
import { ActivityLog } from "@/models";

export type ActivityEntry = {
  /** null for system actions (seed and scripts). */
  actorId: string | null;
  /** Dotted verb, e.g. "user.created", "user.password_reset". */
  action: string;
  entity: string;
  entityId?: string | Types.ObjectId | null;
  meta?: Record<string, unknown>;
};

/** Callers must already be connected and authorised; this only writes the log row. */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  await ActivityLog.create({
    actorId: entry.actorId ? new Types.ObjectId(entry.actorId) : null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ? new Types.ObjectId(entry.entityId.toString()) : null,
    meta: entry.meta ?? {},
  });
}
