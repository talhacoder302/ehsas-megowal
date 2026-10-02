"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { writeLocaleCookie } from "@/i18n/cookie";
import type { ActionResult, ServerErrorCode } from "@/lib/errors";
import { homePathFor } from "@/lib/roles";
import { loginSchema } from "@/lib/validators";
import { runAction } from "@/server/action";
import { signIn, signOut, unstable_update } from "@/server/auth";
import { getLoginLanding, type LoginFailure } from "@/server/auth/login";
import { changeOwnPassword, setOwnLanguage, setOwnPassword } from "@/server/users";

const LOGIN_ERRORS: Record<LoginFailure, ServerErrorCode> = {
  invalid: "invalidCredentials",
  rate_limited: "rateLimited",
  disabled: "accountDisabled",
};

function loginErrorCode(error: AuthError): ServerErrorCode {
  const code = "code" in error && typeof error.code === "string" ? error.code : "invalid";
  return code in LOGIN_ERRORS ? LOGIN_ERRORS[code as LoginFailure] : "invalidCredentials";
}

/** On success this redirects and never returns. */
export async function loginAction(input: unknown, callbackUrl: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidCredentials" };

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: loginErrorCode(error) };
    throw error;
  }

  const landing = await getLoginLanding(parsed.data.mobile, callbackUrl);
  await writeLocaleCookie(landing.language);
  redirect(landing.path);
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

/** Forced password change after logging in with a temporary password. */
export async function setPasswordAction(input: unknown): Promise<ActionResult> {
  const result = await runAction(() => setOwnPassword(input));
  if (!result.ok) return result;

  const session = await unstable_update({});
  redirect(session?.user ? homePathFor(session.user.role) : "/login");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await changeOwnPassword(input);
    return null;
  });
}

export async function changeLanguageAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const language = await setOwnLanguage(input);
    await writeLocaleCookie(language);
    await unstable_update({});
    return null;
  });
}
