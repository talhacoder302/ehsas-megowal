"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getServerEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/errors";
import { formatMobile, mobileToInternational } from "@/lib/validators";
import { runAction } from "@/server/action";
import {
  createUser,
  resetUserPassword,
  setUserStatus,
  updateUser,
  type UserListItem,
} from "@/server/users";

export type TempPasswordResult = {
  user: UserListItem;
  tempPassword: string;
  /** wa.me link with the login details, written in the user's own language. */
  whatsappUrl: string;
};

async function withShareLink(result: { user: UserListItem; tempPassword: string }): Promise<TempPasswordResult> {
  const t = await getTranslations({ locale: result.user.language, namespace: "users" });
  const text = t("whatsappMessage", {
    name: result.user.name,
    mobile: formatMobile(result.user.mobile),
    password: result.tempPassword,
    url: `${getServerEnv().NEXT_PUBLIC_APP_URL}/login`,
  });
  return {
    ...result,
    whatsappUrl: `https://wa.me/${mobileToInternational(result.user.mobile)}?text=${encodeURIComponent(text)}`,
  };
}

function refresh() {
  revalidatePath("/manage/users");
}

export async function createUserAction(input: unknown): Promise<ActionResult<TempPasswordResult>> {
  return runAction(async () => {
    const result = await withShareLink(await createUser(input));
    refresh();
    return result;
  });
}

export async function updateUserAction(userId: string, input: unknown): Promise<ActionResult<UserListItem>> {
  return runAction(async () => {
    const user = await updateUser(userId, input);
    refresh();
    return user;
  });
}

export async function setUserStatusAction(userId: string, enabled: boolean): Promise<ActionResult<UserListItem>> {
  return runAction(async () => {
    const user = await setUserStatus(userId, enabled ? "active" : "disabled");
    refresh();
    return user;
  });
}

export async function resetPasswordAction(userId: string): Promise<ActionResult<TempPasswordResult>> {
  return runAction(async () => {
    const result = await withShareLink(await resetUserPassword(userId));
    refresh();
    return result;
  });
}
