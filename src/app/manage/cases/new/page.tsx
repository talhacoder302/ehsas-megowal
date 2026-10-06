import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CaseForm } from "@/components/manage/cases/case-form";
import { PageHeader } from "@/components/manage/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listMohallas } from "@/server/members";
import { readSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cases.form");
  return { title: t("createTitle") };
}

export default async function NewCasePage() {
  const me = await requirePageUser("/manage/cases/new");
  if (!can(me.role, "cases.manage")) redirect("/manage/cases");

  const [t, mohallas, settings] = await Promise.all([getTranslations("cases"), listMohallas(), readSettings()]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={t("form.createTitle")} subtitle={t("form.createSubtitle")} back={{ href: "/manage/cases", label: t("title") }} />
      <Card>
        <CardContent>
          <CaseForm mohallas={mohallas} showNamesDefault={settings.showBeneficiaryNamesDefault} />
        </CardContent>
      </Card>
    </div>
  );
}
