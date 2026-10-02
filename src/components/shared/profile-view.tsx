import { getTranslations } from "next-intl/server";
import { LanguageForm } from "@/components/shared/language-form";
import { LogoutButton } from "@/components/shared/logout-button";
import { ChangePasswordForm } from "@/components/shared/password-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMobile } from "@/lib/validators";
import type { OwnProfile } from "@/server/users";

/** Profile page body, shared by /manage/profile and /member/profile. */
export async function ProfileView({ profile }: { profile: OwnProfile }) {
  const t = await getTranslations();

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("account.name"), value: profile.name },
    { label: t("account.mobile"), value: <span dir="ltr">{formatMobile(profile.mobile)}</span> },
    { label: t("account.role"), value: <Badge variant="secondary">{t(`roles.${profile.role}`)}</Badge> },
    {
      label: t("account.linkedMember"),
      value: profile.member ? (
        <span>
          <span dir="ltr" className="font-mono text-xs">{profile.member.memberNo}</span> · {profile.member.name}
        </span>
      ) : (
        <span className="text-muted-foreground">{t("account.notLinked")}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("account.profileTitle")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-end font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.languageTitle")}</CardTitle>
          <CardDescription>{t("account.languageSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageForm saved={profile.language} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.changePasswordTitle")}</CardTitle>
          <CardDescription>{t("account.changePasswordSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <LogoutButton className="self-start" />
    </div>
  );
}
