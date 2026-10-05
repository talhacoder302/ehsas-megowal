"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { createAccount } from "@/server/accounts";

export async function createAccountAction(input: unknown): Promise<ActionResult<string>> {
  return runAction(async () => {
    const id = await createAccount(input);
    revalidatePath("/manage", "layout");
    return id;
  });
}
