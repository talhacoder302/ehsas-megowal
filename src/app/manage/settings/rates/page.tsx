import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/manage/page-header";
import { RatesView } from "@/components/manage/settings/rates-view";
import { currentMonth } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listRates } from "@/server/rates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.rates");
  return { title: t("title") };
}

export default async function RatesPage() {
  const me = await requirePageUser("/manage/settings/rates");
  if (!can(me.role, "settings.manage")) redirect("/manage");

  const [t, rates] = await Promise.all([getTranslations("settings"), listRates()]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title={t("rates.title")}
        subtitle={t("rates.subtitle")}
        back={{ href: "/manage/settings", label: t("title") }}
      />
      <RatesView rates={rates} currentMonth={currentMonth()} />
    </div>
  );
}
