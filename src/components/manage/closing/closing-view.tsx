"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangleIcon, BanknoteIcon, CalendarCheckIcon, LockIcon, LockOpenIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/manage/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { closeMonthAction, reopenMonthAction } from "@/app/manage/closing/actions";
import { formatDateTime, formatMonth, shiftMonth } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ClosingView as ClosingViewData, MonthOption } from "@/server/closing";

function StateBadge({ state }: { state: MonthOption["state"] }) {
  const t = useTranslations("closing");
  if (state === "closed") return <Badge className="bg-emerald-600 text-white">{t("stateClosed")}</Badge>;
  if (state === "reopened") return <Badge className="bg-amber-500 text-white">{t("stateReopened")}</Badge>;
  return <Badge variant="outline">{t("stateOpen")}</Badge>;
}

/** One line of the books: label (with an optional hint) and amount. */
function Row({ label, hint, amount, sign, strong, negative }: { label: string; hint?: string; amount: string; sign?: "+" | "−" | "="; strong?: boolean; negative?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-2.5", strong && "border-t font-semibold")}>
      <span className="flex min-w-0 flex-col">
        <span className={cn("text-sm", !strong && "text-muted-foreground")}>
          {sign ? <span className="me-1.5 inline-block w-3 text-center">{sign}</span> : null}
          {label}
        </span>
        {hint ? <span className="ms-[1.125rem] text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span className={cn("shrink-0", strong ? "text-lg" : "font-medium", negative && "text-destructive")}>{amount}</span>
    </div>
  );
}

export function ClosingView({ view }: { view: ClosingViewData }) {
  const t = useTranslations("closing");
  const locale = useLocale() === "ur" ? "ur" : "en";
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const rs = (amount: number) => formatRupees(amount, locale);
  const monthName = formatMonth(view.month, locale);
  const f = view.figures;

  const blockText =
    view.block === "notEnded"
      ? t("blockNotEnded", { month: monthName })
      : view.block === "closePreviousFirst"
        ? t("blockClosePrevious", { month: formatMonth(view.nextToClose, locale) })
        : view.block === "pendingApprovals"
          ? t("blockPending", { count: view.pendingApprovals })
          : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={view.month} onValueChange={(month) => router.push(`/manage/closing?month=${month}`)}>
          <SelectTrigger className="h-10 w-full sm:w-64" aria-label={t("month")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {view.months.map((m) => (
              <SelectItem key={m.month} value={m.month}>
                {formatMonth(m.month, locale)}
                {m.state !== "open" ? ` · ${m.state === "closed" ? t("stateClosed") : t("stateReopened")}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StateBadge state={view.closed ? "closed" : (view.months.find((m) => m.month === view.month)?.state ?? "open")} />
      </div>

      {view.closed ? (
        <Alert>
          <LockIcon />
          <AlertDescription className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {t("closedBy", { name: view.closedByName ?? "—", date: view.closedAt ? formatDateTime(view.closedAt, locale) : "" })}
            </span>
            <span>{t("closedLocked")}</span>
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">{t("liveNote")}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheckIcon className="size-5 text-primary" />
            {monthName}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <Row
            label={t("opening")}
            hint={
              view.openingFrom === "previousClosing"
                ? t("openingFromPrevious", { month: formatMonth(shiftMonth(view.month, -1), locale) })
                : view.openingFrom === "accounts"
                  ? t("openingFromAccounts")
                  : undefined
            }
            amount={rs(f.openingBalance)}
          />
          <Row sign="+" label={t("income")} amount={rs(f.totalIncome)} />
          <Row sign="−" label={t("disbursed")} amount={rs(f.totalDisbursed)} />
          <Row sign="−" label={t("expenses")} amount={rs(f.totalExpenses)} />
          <Row sign="=" label={t("closing")} amount={rs(f.closingBalance)} strong />
          <div className="mt-3 flex flex-col rounded-lg bg-muted/40 px-3">
            <Row sign="−" label={t("committed")} hint={t("committedHint")} amount={rs(f.committedAmount)} />
            <Row sign="−" label={t("reserve")} amount={rs(f.emergencyReserve)} />
            <Row sign="=" label={t("free")} hint={t("freeHint")} amount={rs(f.freeBalance)} strong negative={f.freeBalance < 0} />
          </div>
          {f.freeBalance < 0 ? <p className="mt-3 text-sm text-destructive">{t("freeNegative")}</p> : null}
        </CardContent>
      </Card>

      {!view.closed ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            {blockText ? (
              <Alert>
                <AlertTriangleIcon />
                <AlertDescription>{blockText}</AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("countHint")}{" "}
                  <Link href="/manage/cash-count" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                    <BanknoteIcon className="size-4" />
                    {t("countLink")}
                  </Link>
                </p>
                <Button size="lg" className="self-start" onClick={() => setClosing(true)}>
                  <LockIcon />
                  {t("close", { month: monthName })}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {view.canReopen ? (
        <Button variant="outline" size="lg" className="self-start" onClick={() => setReopening(true)}>
          <LockOpenIcon />
          {t("reopen")}
        </Button>
      ) : null}

      {view.accountBalances.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("accountsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {view.accountBalances.map((a) => (
                <li key={a.accountId} className="flex items-center justify-between gap-3 py-2">
                  <span>{a.name}</span>
                  <span className="font-medium">{rs(a.balance)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {view.reopenings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("historyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {view.reopenings.map((r) => (
                <li key={r.at} className="flex flex-col gap-1 border-s-2 border-amber-500 ps-3">
                  <span className="text-xs text-muted-foreground">
                    {t("historyRow", { name: r.byName, date: formatDateTime(r.at, locale), amount: rs(r.closingBalance) })}
                  </span>
                  <span dir="auto">{r.reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={t("closeTitle", { month: monthName })}
        description={t("closeBody", { month: monthName })}
        confirmLabel={t("close", { month: monthName })}
        onConfirm={() => closeMonthAction(view.month)}
        onDone={() => toast.success(t("closedToast", { month: monthName }))}
      />
      <ReasonDialog
        open={reopening}
        onOpenChange={setReopening}
        title={t("reopenTitle", { month: monthName })}
        description={t("reopenBody", { month: monthName })}
        confirmLabel={t("reopen")}
        placeholder={t("reopenPlaceholder")}
        destructive
        onConfirm={(input) => reopenMonthAction(view.month, input)}
        onDone={() => toast.success(t("reopenedToast", { month: monthName }))}
      />
    </div>
  );
}
