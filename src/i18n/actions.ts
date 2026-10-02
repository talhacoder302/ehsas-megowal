"use server";

import { languageSchema } from "@/lib/validators";
import { unstable_update } from "@/server/auth";
import { getCurrentUser } from "@/server/auth/current-user";
import { setOwnLanguage } from "@/server/users";
import { writeLocaleCookie } from "./cookie";

/** Language switcher: always sets the cookie, and saves the choice on the account when signed in. */
export async function setLocale(input: unknown): Promise<void> {
  const locale = languageSchema.parse(input);
  await writeLocaleCookie(locale);

  if (await getCurrentUser()) {
    await setOwnLanguage(locale);
    await unstable_update({});
  }
}
