"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { addCaseNote, changeApprovedAmount, changeCaseStatus, createCase, updateCase } from "@/server/cases";
import {
  approveDisbursement,
  recordDisbursement,
  rejectDisbursement,
  type RecordedDisbursement,
} from "@/server/disbursements";

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

// Money going out changes cases, account balances and the dashboard.
function refreshMoney() {
  revalidatePath("/manage", "layout");
  revalidatePath("/member/cases");
}

export async function recordDisbursementAction(caseId: string, input: unknown): Promise<ActionResult<RecordedDisbursement>> {
  return runAction(async () => {
    const result = await recordDisbursement(caseId, input);
    refreshMoney();
    return result;
  });
}

export async function approveDisbursementAction(disbursementId: string): Promise<ActionResult<{ fullyPaid: boolean; caseId: string }>> {
  return runAction(async () => {
    const result = await approveDisbursement(disbursementId);
    refreshMoney();
    return result;
  });
}

export async function rejectDisbursementAction(disbursementId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await rejectDisbursement(disbursementId, input);
    refreshMoney();
    return null;
  });
}

export async function changeApprovedAmountAction(caseId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await changeApprovedAmount(caseId, input);
    refreshMoney();
    return null;
  });
}
