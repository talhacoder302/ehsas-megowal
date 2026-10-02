export const locales = ["en", "ur"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie that stores the chosen UI language. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Request header set by the proxy so i18n can pick a per-area default. */
export const AREA_HEADER = "x-ehsas-area";

export type AppArea = "public" | "manage" | "member";

export const localeNames: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function areaFromPath(pathname: string): AppArea {
  if (pathname === "/member" || pathname.startsWith("/member/")) return "member";
  if (pathname === "/manage" || pathname.startsWith("/manage/")) return "manage";
  return "public";
}

/** Member screens default to Urdu, everything else to English. */
export function defaultLocaleForArea(area: string | null | undefined): Locale {
  return area === "member" ? "ur" : defaultLocale;
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ur" ? "rtl" : "ltr";
}
