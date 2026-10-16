import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/manage/page-header";
import { FundSettingsForm } from "@/components/manage/settings/fund-settings-form";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { readSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.fund");
  return { title: t("title") };
}

export default async function FundSettingsPage() {
  const me = await requirePageUser("/manage/settings/fund");
  if (!can(me.role, "settings.manage")) redirect("/manage");
  const [t, settings] = await Promise.all([getTranslations("settings"), readSettings()]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={t("fund.title")} subtitle={t("fund.subtitle")} back={{ href: "/manage/settings", label: t("title") }} />
      <FundSettingsForm
        emergencyReserve={settings.emergencyReserve}
        approvalEnabled={settings.approval.enabled}
        approvalLimit={settings.approval.limit}
        showBeneficiaryNamesDefault={settings.showBeneficiaryNamesDefault}
      />
    </div>
  );
}
