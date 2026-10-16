"use server";

import { revalidatePath } from "next/cache";
import { AppError, type ActionResult } from "@/lib/errors";
import { isImportKind } from "@/lib/imports";
import { runAction } from "@/server/action";
import { previewImport, runImport, type ImportPreview, type ImportResult } from "@/server/imports";
import { completeSetup, saveMemberOpenings, saveOpeningBalances, saveSetupDates, type MemberOpeningError } from "@/server/setup";

export async function saveSetupDatesAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await saveSetupDates(input);
    revalidatePath("/manage", "layout");
    return null;
  });
}

export async function saveOpeningBalancesAction(input: unknown): Promise<ActionResult<number>> {
  return runAction(async () => {
    const changed = await saveOpeningBalances(input);
    revalidatePath("/manage", "layout");
    return changed;
  });
}

export async function saveMemberOpeningsAction(input: unknown): Promise<ActionResult<{ saved: number; errors: MemberOpeningError[] }>> {
  return runAction(async () => {
    const result = await saveMemberOpenings(input);
    revalidatePath("/manage", "layout");
    return result;
  });
}

export async function completeSetupAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    await completeSetup();
    revalidatePath("/manage", "layout");
    return null;
  });
}

export async function previewImportAction(kind: string, form: FormData): Promise<ActionResult<ImportPreview>> {
  return runAction(async () => {
    if (!isImportKind(kind)) throw new AppError("invalidInput");
    return previewImport(kind, form);
  });
}

export async function runImportAction(kind: string, form: FormData): Promise<ActionResult<ImportResult>> {
  return runAction(async () => {
    if (!isImportKind(kind)) throw new AppError("invalidInput");
    const result = await runImport(kind, form);
    revalidatePath("/manage", "layout");
    revalidatePath("/member", "layout");
    return result;
  });
}
