import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/manage/page-header";
import { ReportActions } from "@/components/manage/reports/report-actions";
import { ReportView } from "@/components/shared/reports/report-view";
import { features } from "@/lib/env";
import { can } from "@/lib/permissions";
import { reportMessage, whatsappShareLink } from "@/lib/whatsapp";
import { requirePageUser } from "@/server/auth/guards";
import { countReportEmailRecipients, reportUrl } from "@/server/report-email";
import { getCollectionVsAid, getMonthlyReport, resolveReportMonth } from "@/server/reports";

type Props = { searchParams: Promise<{ month?: string | string[]; version?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

export default async function ManageReportsPage({ searchParams }: Props) {
  const me = await requirePageUser("/manage/reports");
  if (!can(me.role, "reports.view")) redirect("/manage");
  const params = await searchParams;
  const t = await getTranslations("reports");

  const { month, months } = await resolveReportMonth(params.month);
  const canSend = can(me.role, "reports.send");
  const [report, chart, recipients] = await Promise.all([
    getMonthlyReport(month, params.version),
    getCollectionVsAid(),
    canSend && features.email ? countReportEmailRecipients() : Promise.resolve(null),
  ]);

  const whatsappUrl = whatsappShareLink(
    reportMessage({
      programName: report.programName,
      villageName: report.villageName,
      month,
      collection: report.collection.amount,
      paidMembers: report.collection.paidMembers,
      activeMembers: report.collection.activeMembers,
      spent: report.figures.totalDisbursed + report.figures.totalExpenses,
      balance: report.figures.closingBalance,
      provisional: !report.closed,
      reportUrl: reportUrl(month),
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ReportView
        report={report}
        months={months}
        chart={chart}
        basePath="/manage/reports"
        canSwitchVersion
        actions={
          canSend ? <ReportActions month={month} version={report.version} whatsappUrl={whatsappUrl} emailRecipients={recipients} /> : null
        }
      />
    </div>
  );
}
