"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { createExpense } from "@/server/expenses";

export async function createExpenseAction(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const id = await createExpense(input);
    revalidatePath("/manage", "layout");
    return id;
  });
}
