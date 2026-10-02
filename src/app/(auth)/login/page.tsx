import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/shared/auth-shell";
import { LoginForm } from "@/components/shared/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/roles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("login");
  const { callbackUrl } = await searchParams;

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoginForm callbackUrl={safeRedirectPath(callbackUrl) ?? undefined} />
          <p className="text-sm text-muted-foreground">{t("forgot")}</p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
