"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { addRate } from "@/server/rates";

export async function addRateAction(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const id = await addRate(input);
    revalidatePath("/manage", "layout");
    return id;
  });
}
