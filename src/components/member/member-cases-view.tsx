"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HeartHandshakeIcon, ShieldCheckIcon } from "lucide-react";
import { CaseCategoryLabel, CaseStatusBadge } from "@/components/shared/case-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isOpenStatus } from "@/lib/cases";
import { formatDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { CaseListItem } from "@/server/cases";

type MemberTab = "open" | "closed";

/** Cases as members see them: no names unless the family agreed (removed on the server). */
export function MemberCasesView({ cases }: { cases: CaseListItem[] }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [tab, setTab] = useState<MemberTab>("open");

  const shown = useMemo(() => cases.filter((c) => (tab === "open") === isOpenStatus(c.status)), [cases, tab]);
  const openCount = cases.filter((c) => isOpenStatus(c.status)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("memberCases.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("memberCases.subtitle")}</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("memberCases.privacy")}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as MemberTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="open">
            {t("memberCases.open")} ({openCount})
          </TabsTrigger>
          <TabsTrigger value="closed">
            {t("memberCases.closed")} ({cases.length - openCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {shown.length === 0 ? (
        <EmptyState icon={HeartHandshakeIcon} title={t("memberCases.emptyTitle")} description={t("memberCases.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" lang="en" className="font-mono text-xs font-medium">
                      {c.caseNo}
                    </span>
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <CaseCategoryLabel category={c.category} />
                  {c.beneficiaryName ? <span className="text-sm font-medium">{c.beneficiaryName}</span> : null}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex flex-col rounded-lg bg-muted/40 p-2">
                  <dt className="text-xs text-muted-foreground">{t("cases.money.approved")}</dt>
                  <dd className="font-semibold">{c.approvedAmount === null ? "—" : formatRupees(c.approvedAmount, locale)}</dd>
                </div>
                <div className="flex flex-col rounded-lg bg-muted/40 p-2">
                  <dt className="text-xs text-muted-foreground">{t("cases.money.paid")}</dt>
                  <dd className="font-semibold">{formatRupees(c.paidAmount, locale)}</dd>
                </div>
              </dl>
              {c.lastReason ? (
                <p className="text-sm">
                  <span className="text-xs text-muted-foreground">{t("memberCases.lastUpdate", { date: formatDate(c.lastUpdateAt, locale) })} </span>
                  <br />
                  <span dir="auto">{c.lastReason}</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
