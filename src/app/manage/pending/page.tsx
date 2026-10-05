import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PendingView } from "@/components/manage/pending/pending-view";
import { currentMonth, isMonthKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { getPendingReport } from "@/server/pending";
import { readSettings } from "@/server/settings";

type Props = { searchParams: Promise<{ month?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pending");
  return { title: t("title") };
}

export default async function PendingPage({ searchParams }: Props) {
  const me = await requirePageUser("/manage/pending");
  if (!can(me.role, "payments.record")) redirect("/manage");

  const { month: requested } = await searchParams;
  const now = currentMonth();
  // Future months have nothing pending yet.
  const month = isMonthKey(requested) && requested <= now ? requested : now;

  const [report, settings] = await Promise.all([getPendingReport(month), readSettings()]);

  return (
    <PendingView
      key={month}
      report={report}
      currentMonth={now}
      canGenerate={can(me.role, "bills.manage")}
      programName={settings.programName}
      villageName={settings.villageName}
    />
  );
}
