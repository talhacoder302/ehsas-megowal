"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { HandCoinsIcon, HourglassIcon, PlusIcon, SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/manage/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { currentMonth, formatDate, formatMonthShort, monthKey } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { PaymentListItem } from "@/server/payments";

export function PaymentsView({ payments }: { payments: PaymentListItem[] }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [query, setQuery] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (!showCancelled && p.cancelled) return false;
      if (!q) return true;
      return (
        p.memberName.toLowerCase().includes(q) ||
        p.memberNo.toLowerCase().includes(q) ||
        p.receiptNumber.toLowerCase().includes(q)
      );
    });
  }, [payments, query, showCancelled]);

  const thisMonth = currentMonth();
  const monthTotal = payments
    .filter((p) => !p.cancelled && monthKey(p.date) === thisMonth)
    .reduce((sum, p) => sum + p.amount, 0);

  const months = (p: PaymentListItem) => {
    const parts = p.monthsCovered.map((m) => formatMonthShort(m, locale));
    if (p.openingDuePaid > 0) parts.unshift(t("payments.openingDueShort"));
    return parts.join(", ");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title={t("payments.title")}
        subtitle={t("payments.thisMonthTotal", { month: formatMonthShort(thisMonth, locale), amount: formatRupees(monthTotal, locale) })}
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/manage/pending">
                <HourglassIcon />
                {t("manage.nav.pending")}
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/manage/payments/new">
                <PlusIcon />
                {t("payments.receive")}
              </Link>
            </Button>
          </>
        }
      />

      {payments.length === 0 ? (
        <EmptyState
          icon={HandCoinsIcon}
          title={t("payments.emptyTitle")}
          description={t("payments.emptyBody")}
          action={
            <Button asChild size="lg">
              <Link href="/manage/payments/new">
                <PlusIcon />
                {t("payments.receive")}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("payments.searchPlaceholder")}
                aria-label={t("common.search")}
                className="h-10 ps-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showCancelled} onCheckedChange={setShowCancelled} />
              {t("payments.showCancelled")}
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t("payments.noMatchTitle")} description={t("payments.noMatchBody")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/manage/payments/${p.id}`}
                    className={`flex items-start justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50 ${
                      p.cancelled ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span dir="ltr" className="font-mono font-medium text-foreground">
                          {p.receiptNumber}
                        </span>
                        <span>{formatDate(p.date, locale)}</span>
                        {p.cancelled ? <Badge variant="destructive">{t("receipt.cancelled")}</Badge> : null}
                      </div>
                      <span className="truncate font-medium">
                        {p.memberName}{" "}
                        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                          {p.memberNo}
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{months(p)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`paymentMethod.${p.method}`)} · {p.accountName} · {t("payments.by", { name: p.receivedByName })}
                      </span>
                    </div>
                    <span className={`shrink-0 text-lg font-semibold ${p.cancelled ? "line-through" : ""}`}>
                      {formatRupees(p.amount, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
