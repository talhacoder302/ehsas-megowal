"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChartColumnIcon, HandCoinsIcon, HeartHandshakeIcon, InfoIcon, LockIcon, ReceiptIcon, ShieldCheckIcon } from "lucide-react";
import { CaseCategoryLabel, CaseStatusBadge } from "@/components/shared/case-badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMonth, type MonthKey } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { ReportVersion } from "@/lib/reports";
import { cn } from "@/lib/utils";
import type { ChartPoint, MonthlyReport } from "@/server/reports";
import { ReportChart } from "./report-chart";

type ReportViewProps = {
  report: MonthlyReport;
  months: MonthKey[];
  chart: ChartPoint[];
  /** Page the month and version pickers navigate on. */
  basePath: string;
  /** Staff may switch between the heads and members copies. */
  canSwitchVersion: boolean;
  /** Buttons under the month picker (PDF, WhatsApp, email). */
  actions?: React.ReactNode;
};

function Amount({ value, className }: { value: number; className?: string }) {
  const locale = useLocale() === "ur" ? "ur" : "en";
  return <span className={cn("shrink-0 font-medium", value < 0 && "text-destructive", className)}>{formatRupees(value, locale)}</span>;
}

export function ReportView({ report, months, chart, basePath, canSwitchVersion, actions }: ReportViewProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const router = useRouter();
  const f = report.figures;
  const go = (month: MonthKey, version: ReportVersion) =>
    router.push(`${basePath}?month=${month}${canSwitchVersion ? `&version=${version}` : ""}`);
  const paidShare = report.collection.activeMembers ? report.collection.paidMembers / report.collection.activeMembers : 0;

  const tiles = [
    { label: t("reports.collection"), value: f.totalIncome },
    { label: t("reports.aidGiven"), value: f.totalDisbursed },
    { label: t("reports.expenses"), value: f.totalExpenses },
    { label: t("reports.closing"), value: f.closingBalance },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Select value={report.month} onValueChange={(m) => go(m, report.version)}>
          <SelectTrigger className="h-10 w-full sm:w-64" aria-label={t("reports.month")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonth(m, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canSwitchVersion ? (
          <Tabs value={report.version} onValueChange={(v) => go(report.month, v as ReportVersion)}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="heads">{t("reports.headsVersion")}</TabsTrigger>
              <TabsTrigger value="members">{t("reports.membersVersion")}</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}

        {report.version === "members" ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            {t("reports.membersVersionHint")}
          </p>
        ) : null}

        {actions}
      </div>

      {report.closed ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockIcon className="size-4" />
          {t("reports.closedOn", { date: report.closedAt ? formatDate(report.closedAt, locale) : "" })}
        </p>
      ) : (
        <Alert>
          <InfoIcon />
          <AlertDescription>{t("reports.provisional")}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-xl border bg-card p-3">
            <span className="text-xs text-muted-foreground">{tile.label}</span>
            <Amount value={tile.value} className="text-lg font-semibold" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {[
                { label: t("reports.opening"), value: f.openingBalance },
                { label: `+ ${t("reports.collection")}`, value: f.totalIncome },
                { label: `− ${t("reports.aidGiven")}`, value: f.totalDisbursed },
                { label: `− ${t("reports.expenses")}`, value: f.totalExpenses },
                { label: t("reports.closing"), value: f.closingBalance, strong: true },
                { label: `− ${t("reports.committed")}`, value: f.committedAmount },
                { label: `− ${t("reports.reserve")}`, value: f.emergencyReserve },
                { label: t("reports.free"), value: f.freeBalance, strong: true },
              ].map((row) => (
                <div key={row.label} className={cn("flex items-center justify-between gap-3 py-2", row.strong && "font-semibold")}>
                  <dt className={row.strong ? undefined : "text-muted-foreground"}>{row.label}</dt>
                  <dd>
                    <Amount value={row.value} className={row.strong ? "text-base font-semibold" : undefined} />
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoinsIcon className="size-5 text-primary" />
              {t("reports.collectionTitle")}
            </CardTitle>
            <CardDescription>{t("reports.collectionHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm font-medium">
                {t("reports.membersPaid", { paid: report.collection.paidMembers, total: report.collection.activeMembers })}
              </span>
              <Amount value={report.collection.amount} className="text-lg font-semibold" />
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={report.collection.activeMembers}
              aria-valuenow={report.collection.paidMembers}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(paidShare * 100)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{t("reports.payments", { count: report.collection.payments })}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <HeartHandshakeIcon className="size-5 text-primary" />
                {t("reports.aidTitle")}
              </span>
              <Amount value={report.aid.total} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.aid.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("reports.noAid")}</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {report.aid.groups.map((g) => (
                  <li key={g.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3 border-b pb-1">
                      <CaseCategoryLabel category={g.category} className="font-medium" />
                      <Amount value={g.total} />
                    </div>
                    <ul className="flex flex-col gap-1 ps-6">
                      {g.cases.map((c) => (
                        <li key={c.caseNo} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span dir="ltr" lang="en" className="font-mono text-xs">
                              {c.caseNo}
                            </span>
                            <span className={cn("truncate", !c.beneficiaryName && "text-xs text-muted-foreground")}>
                              {c.beneficiaryName ?? t("reports.nameHidden")}
                            </span>
                          </span>
                          <Amount value={c.amount} className="font-normal" />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ReceiptIcon className="size-5 text-primary" />
                {t("reports.expensesTitle")}
              </span>
              <Amount value={report.expenses.total} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.expenses.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("reports.noExpenses")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {report.expenses.groups.map((g) => (
                  <li key={g.category} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex flex-col">
                      <span>{t(`expenseCategory.${g.category}`)}</span>
                      <span className="text-xs text-muted-foreground">{t("reports.expenseCount", { count: g.count })}</span>
                    </span>
                    <Amount value={g.total} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.openCasesTitle")}</CardTitle>
          <CardDescription>{t("reports.openCasesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {report.openCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("reports.noOpenCases")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {report.openCases.map((c) => (
                <li key={c.caseNo} className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" lang="en" className="font-mono text-xs font-medium">
                      {c.caseNo}
                    </span>
                    <CaseStatusBadge status={c.status} />
                    <CaseCategoryLabel category={c.category} />
                  </div>
                  {c.beneficiaryName ? <span className="font-medium">{c.beneficiaryName}</span> : null}
                  <span className="text-xs text-muted-foreground">
                    {c.approvedAmount === null
                      ? t("reports.notApproved")
                      : t("reports.approvedPaid", {
                          approved: formatRupees(c.approvedAmount, locale),
                          paid: formatRupees(c.paidAmount, locale),
                        })}
                  </span>
                  {c.lastReason ? (
                    <p dir="auto" className="rounded-md bg-muted/50 px-2 py-1.5">
                      {c.lastReason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartColumnIcon className="size-5 text-primary" />
            {t("reports.chartTitle")}
          </CardTitle>
          <CardDescription>{t("reports.chartSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportChart points={chart} />
        </CardContent>
      </Card>
    </div>
  );
}
