"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { recordCashCount } from "@/server/cash-counts";

export async function recordCashCountAction(input: unknown): Promise<ActionResult<{ id: string; difference: number }>> {
  return runAction(async () => {
    const result = await recordCashCount(input);
    revalidatePath("/manage/cash-count");
    return result;
  });
}
