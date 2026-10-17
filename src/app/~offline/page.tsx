import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListIcon, WifiOffIcon } from "lucide-react";
import { RetryButton } from "@/components/shared/retry-button";
import { locales } from "@/i18n/config";

export const metadata: Metadata = { title: "Offline" };

/**
 * Shown by the service worker when a page cannot load without internet. It is
 * cached once at install time, so it shows both languages instead of
 * depending on the language cookie.
 */
export default async function OfflinePage() {
  const texts = await Promise.all(
    locales.map(async (locale) => {
      const t = await getTranslations({ locale, namespace: "offline" });
      return { locale, title: t("title"), body: t("body"), lists: t("lists"), members: t("members"), pending: t("pending"), retry: t("retry") };
    }),
  );

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <span className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <WifiOffIcon className="size-7" />
      </span>
      {texts.map((x) => (
        <section key={x.locale} lang={x.locale} dir={x.locale === "ur" ? "rtl" : "ltr"} className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">{x.title}</h1>
          <p className="text-sm text-muted-foreground">{x.body}</p>
        </section>
      ))}
      <RetryButton label={texts.map((x) => x.retry).join(" / ")} />
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        {texts.map((x) => (
          <p key={x.locale} lang={x.locale} dir={x.locale === "ur" ? "rtl" : "ltr"} className="text-xs text-muted-foreground">
            {x.lists}
          </p>
        ))}
        <Link href="/manage/members" className="flex items-center gap-2 text-sm font-medium text-primary">
          <ListIcon className="size-4" />
          {texts.map((x) => x.members).join(" / ")}
        </Link>
        <Link href="/manage/pending" className="flex items-center gap-2 text-sm font-medium text-primary">
          <ListIcon className="size-4" />
          {texts.map((x) => x.pending).join(" / ")}
        </Link>
      </div>
    </main>
  );
}
