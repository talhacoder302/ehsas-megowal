"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { updateFundSettings } from "@/server/settings-admin";

export async function updateFundSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await updateFundSettings(input);
    revalidatePath("/manage", "layout");
    return null;
  });
}
