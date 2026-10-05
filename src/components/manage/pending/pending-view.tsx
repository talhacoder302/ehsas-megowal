"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { BellIcon, FilePlus2Icon, HandCoinsIcon, Loader2Icon, PartyPopperIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/manage/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateBillsAction } from "@/app/manage/pending/actions";
import { formatMonth, formatMonthShort, shiftMonth, type MonthKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { formatMobile } from "@/lib/validators";
import { reminderMessage, whatsappLink } from "@/lib/whatsapp";
import type { PendingReport } from "@/server/pending";

type PendingViewProps = {
  report: PendingReport;
  currentMonth: MonthKey;
  canGenerate: boolean;
  programName: string;
  villageName: string;
};

/** How many past months the month picker offers. */
const MONTHS_BACK = 24;

export function PendingView({ report, currentMonth, canGenerate, programName, villageName }: PendingViewProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<ServerErrorCode | null>(null);

  const monthOptions = useMemo(
    () => Array.from({ length: MONTHS_BACK + 1 }, (_, i) => shiftMonth(currentMonth, -i)),
    [currentMonth],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return report.rows;
    return report.rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.memberNo.toLowerCase().includes(q) || r.mohalla.toLowerCase().includes(q),
    );
  }, [report.rows, query]);

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    const result = await generateBillsAction(report.month);
    setGenerating(false);
    if (!result.ok) return setGenerateError(result.error);
    const { created, alreadyBilled } = result.data;
    if (created === 0) toast.info(t("pending.generateNone", { existing: alreadyBilled }));
    else toast.success(t("pending.generateDone", { created, existing: alreadyBilled }));
  }

  const missing = Math.max(0, report.billableCount - report.billCount);
  const monthName = formatMonth(report.month, locale);

  const stats = [
    { label: t("pending.billed"), value: formatRupees(report.billed, locale) },
    { label: t("pending.collected"), value: formatRupees(report.collected, locale), tone: "text-emerald-700 dark:text-emerald-400" },
    { label: t("pending.pending"), value: formatRupees(report.pending, locale), tone: report.pending > 0 ? "text-destructive" : "" },
    { label: t("pending.percent"), value: report.percent === null ? "—" : `${report.percent}%` },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title={t("pending.title")}
        subtitle={t("pending.subtitle")}
        actions={
          <Select value={report.month} onValueChange={(m) => router.push(`/manage/pending?month=${m}`)}>
            <SelectTrigger className="h-10 w-48" aria-label={t("pending.month")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-xl border bg-card p-3">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className={`text-xl font-semibold ${s.tone ?? ""}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {report.percent !== null ? (
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={report.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, report.percent)}%` }} />
        </div>
      ) : null}

      {/* Bill generation for the month */}
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">
              {t("pending.billsMade", { made: report.billCount, total: report.billableCount, month: monthName })}
            </span>
            <span className="text-muted-foreground">
              {report.rate === null
                ? t("pending.noRate")
                : t("pending.rateForMonth", { amount: formatRupees(report.rate, locale) })}
              {report.waivedCount > 0 ? ` · ${t("pending.waived", { count: report.waivedCount })}` : ""}
            </span>
          </div>
          {canGenerate ? (
            <Button
              size="lg"
              variant={missing > 0 ? "default" : "outline"}
              disabled={generating || report.rate === null}
              onClick={generate}
            >
              {generating ? <Loader2Icon className="animate-spin" /> : <FilePlus2Icon />}
              {t("pending.generate", { month: formatMonthShort(report.month, locale) })}
            </Button>
          ) : null}
        </CardContent>
        {generateError ? (
          <div className="px-4 pb-4">
            <FormError code={generateError} />
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-1">
        <h2 className="font-medium">
          {t("pending.listTitle", { count: report.rows.length, amount: formatRupees(report.totalDue, locale) })}
        </h2>
        <p className="text-xs text-muted-foreground">{t("pending.listHint", { month: monthName })}</p>
      </div>

      {report.rows.length === 0 ? (
        <EmptyState icon={PartyPopperIcon} title={t("pending.allClearTitle")} description={t("pending.allClearBody")} />
      ) : (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("pending.searchPlaceholder")}
              aria-label={t("common.search")}
              className="h-10 ps-9"
            />
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const reminder = r.mobile
                ? whatsappLink(
                    r.mobile,
                    reminderMessage({
                      name: r.name,
                      programName,
                      villageName,
                      months: r.months.map((m) => m.month),
                      openingDue: r.openingDue,
                      totalDue: r.totalDue,
                    }),
                  )
                : null;
              return (
                <li key={r.memberId} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/manage/members/${r.memberId}?tab=contributions`} className="flex min-w-0 flex-col gap-0.5 hover:underline">
                      <span className="truncate font-medium">
                        {r.name}{" "}
                        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                          {r.memberNo}
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {r.mohalla}
                        {r.mobile ? (
                          <>
                            {" · "}
                            <span dir="ltr">{formatMobile(r.mobile)}</span>
                          </>
                        ) : null}
                      </span>
                    </Link>
                    <span className="shrink-0 text-lg font-semibold text-destructive">{formatRupees(r.totalDue, locale)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {r.openingDue > 0 ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-300">
                        {t("payments.openingDueShort")} {formatRupees(r.openingDue, locale)}
                      </span>
                    ) : null}
                    {r.months.map((m) => (
                      <span key={m.month} className="rounded-full bg-muted px-2 py-0.5">
                        {formatMonthShort(m.month, locale)}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {reminder ? (
                      <Button asChild variant="outline">
                        <a href={reminder} target="_blank" rel="noopener noreferrer">
                          <BellIcon />
                          {t("pending.reminder")}
                        </a>
                      </Button>
                    ) : (
                      <Button variant="outline" disabled title={t("pending.noMobile")}>
                        <BellIcon />
                        {t("pending.reminder")}
                      </Button>
                    )}
                    <Button asChild>
                      <Link href={`/manage/payments/new?member=${r.memberId}`}>
                        <HandCoinsIcon />
                        {t("payments.receive")}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
