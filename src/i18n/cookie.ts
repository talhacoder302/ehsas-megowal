import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./config";

/** Only callable from Server Actions and route handlers (cookies are read-only in pages). */
export async function writeLocaleCookie(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
