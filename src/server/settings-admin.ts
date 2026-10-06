import "server-only";
import { requirePermission } from "@/lib/permissions";
import { approvalSettingsSchema } from "@/lib/validators";
import { Settings } from "@/models";
import { logActivity } from "./activity-log";
import { readSettings } from "./settings";

// Settings changes made on screen (admin only). Kept apart from settings.ts,
// which scripts import and which must not pull in the auth code.

/** Admin: turn second-head approval on or off and set the limit. */
export async function updateApprovalSettings(input: unknown): Promise<void> {
  const actor = await requirePermission("settings.manage");
  const values = approvalSettingsSchema.parse(input);
  const before = (await readSettings()).approval;

  await Settings.updateOne(
    { key: "main" },
    { $set: { secondHeadApprovalEnabled: values.enabled, secondHeadApprovalLimit: values.limit } },
    { upsert: true, runValidators: true },
  );
  await logActivity({
    actorId: actor.id,
    action: "settings.updated",
    entity: "Settings",
    meta: {
      changes: {
        secondHeadApprovalEnabled: { from: before.enabled, to: values.enabled },
        secondHeadApprovalLimit: { from: before.limit, to: values.limit },
      },
    },
  });
}
