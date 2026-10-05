"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { generateBills } from "@/server/bills";
import type { BillRunResult } from "@/server/contributions-core";

export async function generateBillsAction(month: unknown): Promise<ActionResult<BillRunResult>> {
  return runAction(async () => {
    const result = await generateBills(month);
    revalidatePath("/manage", "layout");
    return result;
  });
}
