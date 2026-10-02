import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { LoginForm } from "@/components/shared/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations("login");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-md items-center justify-between gap-2 px-4">
        <Brand />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <LoginForm />
            <p className="text-sm text-muted-foreground">{t("forgot")}</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
