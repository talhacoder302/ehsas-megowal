"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { closeMonth, reopenMonth } from "@/server/closing";

export async function closeMonthAction(month: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await closeMonth(month);
    revalidatePath("/manage", "layout");
    return null;
  });
}

export async function reopenMonthAction(month: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await reopenMonth(month, input);
    revalidatePath("/manage", "layout");
    return null;
  });
}
