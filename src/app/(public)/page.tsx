import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HeartHandshakeIcon, LogInIcon, ScaleIcon, SmartphoneIcon } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localeDirection, locales } from "@/i18n/config";
import { homePathFor } from "@/lib/roles";
import { auth } from "@/server/auth";

const points = [
  { key: "transparent", icon: ScaleIcon },
  { key: "aid", icon: HeartHandshakeIcon },
  { key: "members", icon: SmartphoneIcon },
] as const;

export default async function LandingPage() {
  const locale = await getLocale();
  const t = await getTranslations();
  const session = await auth();
  const home = session?.user?.role ? homePathFor(session.user.role) : null;

  // The short description is always shown in both languages, current language first.
  const ordered = [locale, ...locales.filter((l) => l !== locale)];
  const about = await Promise.all(
    ordered.map(async (l) => {
      const tl = await getTranslations({ locale: l });
      return { locale: l, name: tl("common.programName"), text: tl("landing.about") };
    }),
  );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <Brand />
        <LanguageSwitcher />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-8 md:py-16">
        <section className="flex flex-col items-center gap-6 text-center">
          <Badge variant="secondary">{t("common.tagline")}</Badge>
          <h1 className="flex flex-col gap-2 text-3xl font-bold tracking-tight md:text-5xl">
            {about.map((a) => (
              <span key={a.locale} lang={a.locale} dir={localeDirection(a.locale)}>
                {a.name}
              </span>
            ))}
          </h1>
          <p className="text-muted-foreground">{t("common.village")}</p>

          <div className="grid w-full gap-4 text-start md:grid-cols-2">
            {about.map((a) => (
              <Card key={a.locale} lang={a.locale} dir={localeDirection(a.locale)}>
                <CardContent className="text-sm text-muted-foreground md:text-base">{a.text}</CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button asChild size="lg" className="h-11 px-6 text-base">
              <Link href={home ?? "/login"}>
                <LogInIcon className="rtl:-scale-x-100" />
                {home ? t("landing.openAccount") : t("landing.loginCta")}
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">{t("landing.loginNote")}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {points.map(({ key, icon: Icon }) => (
            <Card key={key}>
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <CardTitle>{t(`landing.points.${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t(`landing.points.${key}.body`)}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">{t("landing.footer")}</footer>
    </div>
  );
}
