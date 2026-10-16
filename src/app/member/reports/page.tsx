import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FileDownIcon } from "lucide-react";
import { ReportView } from "@/components/shared/reports/report-view";
import { Button } from "@/components/ui/button";
import { getCollectionVsAid, getMonthlyReport, resolveReportMonth } from "@/server/reports";

type Props = { searchParams: Promise<{ month?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

/** Members only ever get the members copy (enforced in getMonthlyReport and the PDF route). */
export default async function MemberReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { month, months } = await resolveReportMonth(params.month);
  const [t, locale, report, chart] = await Promise.all([
    getTranslations("reports"),
    getLocale(),
    getMonthlyReport(month, "members"),
    getCollectionVsAid(),
  ]);
  const pdf = (lang: "en" | "ur") => `/api/reports/${month}/pdf?version=members&lang=${lang}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ReportView
        report={report}
        months={months}
        chart={chart}
        basePath="/member/reports"
        canSwitchVersion={false}
        actions={
          <div className="grid grid-cols-2 gap-2">
            {(locale === "ur" ? (["ur", "en"] as const) : (["en", "ur"] as const)).map((lang) => (
              <Button key={lang} asChild variant="outline" size="lg">
                <a href={pdf(lang)} target="_blank" rel="noopener noreferrer">
                  <FileDownIcon />
                  <span lang={lang}>{`PDF · ${lang === "ur" ? t("pdfUrdu") : t("pdfEnglish")}`}</span>
                </a>
              </Button>
            ))}
          </div>
        }
      />
    </div>
  );
}
