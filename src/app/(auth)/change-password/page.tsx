import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/shared/auth-shell";
import { LogoutButton } from "@/components/shared/logout-button";
import { SetPasswordForm } from "@/components/shared/password-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { homePathFor } from "@/lib/roles";
import { getCurrentUser } from "@/server/auth/current-user";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("forcedTitle") };
}

export default async function ChangePasswordPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/api/session/refresh?next=/change-password");
  if (!me.mustChangePassword) redirect(homePathFor(me.role));

  const t = await getTranslations("account");

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("forcedTitle")}</CardTitle>
          <CardDescription>{t("forcedSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SetPasswordForm />
          <LogoutButton variant="ghost" className="self-start" />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
