"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE, locales } from "./config";

const localeSchema = z.enum(locales);

export async function setLocale(input: unknown): Promise<void> {
  const locale = localeSchema.parse(input);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
