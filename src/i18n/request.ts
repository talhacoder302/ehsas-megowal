import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { AREA_HEADER, LOCALE_COOKIE, defaultLocaleForArea, isLocale, type Locale } from "./config";
import { messages } from "./messages";
import { TIME_ZONE } from "@/lib/dates";

async function resolveLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return defaultLocaleForArea(headerStore.get(AREA_HEADER));
}

export default getRequestConfig(async ({ locale: requested }) => {
  // An explicit locale (e.g. getTranslations({ locale: "ur" })) wins over the cookie.
  const locale = isLocale(requested) ? requested : await resolveLocale();
  return {
    locale,
    messages: messages[locale],
    timeZone: TIME_ZONE,
  };
});
