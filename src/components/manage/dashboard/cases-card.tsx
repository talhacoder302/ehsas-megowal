import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HeartHandshakeIcon } from "lucide-react";
import { CaseStatusBadge } from "@/components/shared/case-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OPEN_STATUSES } from "@/lib/cases";
import type { DashboardCases } from "@/server/dashboard";

/** Open cases by status, and the ones on hold or waiting too long for an update. */
export async function CasesCard({ data }: { data: DashboardCases }) {
  const t = await getTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartHandshakeIcon className="size-5 text-primary" />
          {t("dashboard.casesTitle", { count: data.open })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OPEN_STATUSES.map((s) => (
            <li key={s} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2">
              <CaseStatusBadge status={s} />
              <span className="font-semibold">{data.byStatus[s]}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("dashboard.attentionTitle", { count: data.attentionCount })}</span>
          {data.attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.attentionNone")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.attention.map((c) => (
                <li key={c.id}>
                  <Link href={`/manage/cases/${c.id}`} className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-sm hover:bg-amber-500/10">
                    <span className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" lang="en" className="font-mono text-xs font-medium">
                        {c.caseNo}
                      </span>
                      <CaseStatusBadge status={c.status} />
                      <span className="truncate">{c.beneficiaryName}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{t("cases.staleFlag", { days: c.daysSinceUpdate })}</span>
                    {c.lastReason ? (
                      <span dir="auto" className="line-clamp-2 text-xs">
                        {c.lastReason}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data.attentionCount > data.attention.length ? (
            <Link href="/manage/cases" className="self-start text-sm text-primary underline-offset-4 hover:underline">
              {t("dashboard.attentionMore", { count: data.attentionCount - data.attention.length })}
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
