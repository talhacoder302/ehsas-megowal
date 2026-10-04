"use server";

import { revalidatePath } from "next/cache";
import { getServerEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/errors";
import { memberLoginMessage, whatsappLink } from "@/lib/whatsapp";
import { runAction } from "@/server/action";
import { changeMemberStatus, createMember, updateMember } from "@/server/members";
import { readSettings } from "@/server/settings";
import { createMemberLogin } from "@/server/users";

export type MemberLoginShare = {
  name: string;
  mobile: string;
  tempPassword: string;
  /** wa.me link with the login details in Roman Urdu. */
  whatsappUrl: string;
};

function refresh(memberId?: string) {
  revalidatePath("/manage/members");
  if (memberId) revalidatePath(`/manage/members/${memberId}`);
}

export async function createMemberAction(input: unknown): Promise<ActionResult<{ id: string; memberNo: string }>> {
  return runAction(async () => {
    const created = await createMember(input);
    refresh();
    return created;
  });
}

export async function updateMemberAction(memberId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await updateMember(memberId, input);
    refresh(memberId);
    return null;
  });
}

export async function changeMemberStatusAction(memberId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await changeMemberStatus(memberId, input);
    refresh(memberId);
    revalidatePath("/manage/users");
    return null;
  });
}

export async function createMemberLoginAction(memberId: string): Promise<ActionResult<MemberLoginShare>> {
  return runAction(async () => {
    const login = await createMemberLogin(memberId);
    const settings = await readSettings();
    const text = memberLoginMessage({
      name: login.name,
      programName: settings.programName,
      villageName: settings.villageName,
      loginUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}/login`,
      mobile: login.mobile,
      password: login.tempPassword,
    });
    refresh(memberId);
    revalidatePath("/manage/users");
    return { ...login, whatsappUrl: whatsappLink(login.mobile, text) };
  });
}
