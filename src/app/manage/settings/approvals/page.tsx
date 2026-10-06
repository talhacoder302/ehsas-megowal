import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/manage/page-header";
import { ApprovalSettingsForm } from "@/components/manage/settings/approval-settings-form";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { readSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.approvals");
  return { title: t("title") };
}

export default async function ApprovalSettingsPage() {
  const me = await requirePageUser("/manage/settings/approvals");
  if (!can(me.role, "settings.manage")) redirect("/manage");
  const [t, settings] = await Promise.all([getTranslations("settings"), readSettings()]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={t("approvals.title")} subtitle={t("approvals.subtitle")} back={{ href: "/manage/settings", label: t("title") }} />
      <ApprovalSettingsForm enabled={settings.approval.enabled} limit={settings.approval.limit} />
    </div>
  );
}
