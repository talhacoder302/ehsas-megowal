"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { addCaseNote, changeCaseStatus, createCase, updateCase } from "@/server/cases";

// Cases show in the manage screens and in the member portal.
function refresh() {
  revalidatePath("/manage/cases", "layout");
  revalidatePath("/member/cases");
}

export async function createCaseAction(input: unknown): Promise<ActionResult<{ id: string; caseNo: string }>> {
  return runAction(async () => {
    const created = await createCase(input);
    refresh();
    return created;
  });
}

export async function updateCaseAction(caseId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await updateCase(caseId, input);
    refresh();
    return null;
  });
}

export async function changeCaseStatusAction(caseId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await changeCaseStatus(caseId, input);
    refresh();
    return null;
  });
}

export async function addCaseNoteAction(caseId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await addCaseNote(caseId, input);
    refresh();
    return null;
  });
}
