"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { cancelPayment, receivePayment } from "@/server/payments";

// A payment changes members' dues, the pending page and account balances.
function refresh() {
  revalidatePath("/manage", "layout");
}

export async function receivePaymentAction(input: unknown): Promise<ActionResult<{ id: string; receiptNumber: string }>> {
  return runAction(async () => {
    const result = await receivePayment(input);
    refresh();
    return result;
  });
}

export async function cancelPaymentAction(incomeId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await cancelPayment(incomeId, input);
    refresh();
    return null;
  });
}
