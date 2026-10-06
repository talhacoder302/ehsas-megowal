"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CircleAlertIcon, HeartHandshakeIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { PageHeader } from "@/components/manage/page-header";
import { CaseCategoryLabel, CaseStatusBadge } from "@/components/shared/case-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CASE_CATEGORIES, caseTab, daysSince, isStale, needsAttention, type CaseCategory, type CaseTab } from "@/lib/cases";
import { dateKey, formatDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CaseListItem } from "@/server/cases";

type CasesViewProps = {
  cases: CaseListItem[];
  canManage: boolean;
  /** Server time, so "days since" is the same on the server and in the browser. */
  now: string;
};

const TABS: CaseTab[] = ["open", "completed", "rejected"];

export function CasesView({ cases, canManage, now }: CasesViewProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [tab, setTab] = useState<CaseTab>("open");
  const [category, setCategory] = useState<"all" | CaseCategory>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const out: Record<CaseTab, number> = { open: 0, completed: 0, rejected: 0 };
    for (const c of cases) out[caseTab(c.status)] += 1;
    return out;
  }, [cases]);
  const attention = cases.filter((c) => needsAttention(c.status, c.lastUpdateAt, new Date(now))).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nowDate = new Date(now);
    return cases
      .filter((c) => caseTab(c.status) === tab)
      .filter((c) => category === "all" || c.category === category)
      .filter((c) => {
        const opened = dateKey(c.createdAt);
        return (!from || opened >= from) && (!to || opened <= to);
      })
      .filter(
        (c) =>
          !q ||
          c.caseNo.toLowerCase().includes(q) ||
          (c.beneficiaryName?.toLowerCase().includes(q) ?? false) ||
          (c.mohalla?.toLowerCase().includes(q) ?? false),
      )
      .sort((a, b) => {
        // Cases that need attention come first on the Open tab.
        const flag = Number(needsAttention(b.status, b.lastUpdateAt, nowDate)) - Number(needsAttention(a.status, a.lastUpdateAt, nowDate));
        return flag || (a.createdAt < b.createdAt ? 1 : -1);
      });
  }, [cases, tab, category, from, to, query, now]);

  const filtersOn = category !== "all" || from !== "" || to !== "" || query !== "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title={t("cases.title")}
        subtitle={
          attention > 0
            ? t("cases.subtitleAttention", { open: counts.open, attention })
            : t("cases.subtitle", { open: counts.open })
        }
        actions={
          canManage ? (
            <Button asChild size="lg">
              <Link href="/manage/cases/new">
                <PlusIcon />
                {t("cases.add")}
              </Link>
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CaseTab)}>
        <TabsList className="w-full sm:w-auto">
          {TABS.map((x) => (
            <TabsTrigger key={x} value={x}>
              {t(`cases.tabs.${x}`)} ({counts[x]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("cases.searchPlaceholder")}
            aria-label={t("common.search")}
            className="h-10 ps-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v as "all" | CaseCategory)}>
          <SelectTrigger className="h-10 w-full" aria-label={t("cases.form.category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("cases.allCategories")}</SelectItem>
            {CASE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`caseCategory.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-12 shrink-0 text-muted-foreground">{t("cases.from")}</span>
          <Input type="date" dir="ltr" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-10" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-12 shrink-0 text-muted-foreground">{t("cases.to")}</span>
          <Input type="date" dir="ltr" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </label>
      </div>
      {filtersOn ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setCategory("all");
            setFrom("");
            setTo("");
            setQuery("");
          }}
        >
          <XIcon />
          {t("cases.clearFilters")}
        </Button>
      ) : null}

      {cases.length === 0 ? (
        <EmptyState
          icon={HeartHandshakeIcon}
          title={t("cases.emptyTitle")}
          description={t("cases.emptyBody")}
          action={
            canManage ? (
              <Button asChild size="lg">
                <Link href="/manage/cases/new">
                  <PlusIcon />
                  {t("cases.add")}
                </Link>
              </Button>
            ) : null
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("cases.noMatchTitle")} description={t("cases.noMatchBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((c) => {
            const days = daysSince(c.lastUpdateAt, new Date(now));
            const stale = isStale(c.status, c.lastUpdateAt, new Date(now));
            const flagged = c.status === "on_hold" || stale;
            return (
              <li key={c.id}>
                <Link
                  href={`/manage/cases/${c.id}`}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50",
                    flagged && "border-amber-500/60 bg-amber-500/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span dir="ltr" className="font-mono text-xs font-medium">
                          {c.caseNo}
                        </span>
                        <CaseStatusBadge status={c.status} />
                      </div>
                      <span className="truncate font-medium">{c.beneficiaryName}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <CaseCategoryLabel category={c.category} className="text-xs" />
                        {c.mohalla ? <span>· {c.mohalla}</span> : null}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end text-end">
                      <span className="text-xs text-muted-foreground">
                        {c.approvedAmount !== null ? t("cases.approved") : t("cases.estimated")}
                      </span>
                      <span className="font-semibold">{formatRupees(c.approvedAmount ?? c.estimatedAmount, locale)}</span>
                    </div>
                  </div>
                  {flagged ? (
                    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      <CircleAlertIcon className="size-3.5" />
                      {c.status === "on_hold" && !stale ? t("cases.onHoldFlag") : t("cases.staleFlag", { days })}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {t("cases.lastUpdate", { date: formatDate(c.lastUpdateAt, locale) })}
                    {c.lastReason ? (
                      <>
                        {" · "}
                        <span dir="auto" className="text-foreground">{c.lastReason}</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
