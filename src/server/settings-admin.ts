import "server-only";
import { requirePermission } from "@/lib/permissions";
import { fundSettingsSchema } from "@/lib/validators";
import { Settings } from "@/models";
import { logActivity } from "./activity-log";
import { readSettings } from "./settings";

// Settings changes made on screen (admin only). Kept apart from settings.ts,
// which scripts import and which must not pull in the auth code.

/** Admin: emergency reserve, second-head approval and the beneficiary name default. */
export async function updateFundSettings(input: unknown): Promise<void> {
  const actor = await requirePermission("settings.manage");
  const values = fundSettingsSchema.parse(input);
  const before = await readSettings();

  const next = {
    emergencyReserveAmount: values.emergencyReserve,
    secondHeadApprovalEnabled: values.approvalEnabled,
    secondHeadApprovalLimit: values.approvalLimit,
    showBeneficiaryNamesDefault: values.showBeneficiaryNamesDefault,
  };
  const previous: typeof next = {
    emergencyReserveAmount: before.emergencyReserve,
    secondHeadApprovalEnabled: before.approval.enabled,
    secondHeadApprovalLimit: before.approval.limit,
    showBeneficiaryNamesDefault: before.showBeneficiaryNamesDefault,
  };
  const changes = Object.fromEntries(
    (Object.keys(next) as (keyof typeof next)[])
      .filter((key) => next[key] !== previous[key])
      .map((key) => [key, { from: previous[key], to: next[key] }]),
  );
  if (Object.keys(changes).length === 0) return;

  await Settings.updateOne({ key: "main" }, { $set: next }, { upsert: true, runValidators: true });
  await logActivity({ actorId: actor.id, action: "settings.updated", entity: "Settings", meta: { changes } });
}
