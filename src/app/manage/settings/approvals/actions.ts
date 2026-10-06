"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { updateApprovalSettings } from "@/server/settings-admin";

export async function updateApprovalSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await updateApprovalSettings(input);
    revalidatePath("/manage", "layout");
    return null;
  });
}
