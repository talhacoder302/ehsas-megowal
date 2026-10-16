"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheckIcon, CheckCircle2Icon, ClipboardCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { completeSetupAction } from "@/app/manage/setup/actions";
import { formatDateTime, formatMonth, type MonthKey } from "@/lib/dates";
import { MEMBER_STATUSES } from "@/lib/member-status";
import { formatRupees } from "@/lib/money";
import type { Reconciliation } from "@/server/setup";

type SummaryStepProps = {
  reconciliation: Reconciliation;
  firstMonth: MonthKey | null;
  completedAt: string | null;
  locked: boolean;
};

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}

/** Step 5: totals to compare with the paper register before closing the first month. */
export function SummaryStep({ reconciliation: r, firstMonth, completedAt, locked }: SummaryStepProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [confirming, setConfirming] = useState(false);
  const rs = (n: number) => formatRupees(n, locale);

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        <ClipboardCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("setup.summary.compare")}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("setup.summary.membersTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <Line label={t("setup.summary.totalMembers")} value={String(r.members.total)} strong />
              {MEMBER_STATUSES.map((s) => (
                <Line key={s} label={t(`memberStatus.${s}`)} value={String(r.members.byStatus[s])} />
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("setup.summary.duesTitle")}</CardTitle>
            <CardDescription>{t("setup.summary.duesHint", { count: r.openingDues.members })}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <Line label={t("setup.summary.duesOriginal")} value={rs(r.openingDues.original)} strong />
              <Line label={t("setup.summary.duesPaid")} value={rs(r.openingDues.paidSince)} />
              <Line label={t("setup.summary.duesRemaining")} value={rs(r.openingDues.remaining)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("setup.summary.accountsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {r.accounts.map((a) => (
                <div key={a.name} className="flex items-center justify-between gap-3 py-2">
                  <dt className="flex flex-col">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{t("setup.summary.openingWas", { amount: rs(a.openingBalance) })}</span>
                  </dt>
                  <dd className="font-semibold">{rs(a.balance)}</dd>
                </div>
              ))}
              <Line label={t("setup.summary.openingTotal")} value={rs(r.openingTotal)} strong />
              <Line label={t("setup.summary.balanceTotal")} value={rs(r.balanceTotal)} strong />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("setup.summary.registerTitle")}</CardTitle>
            <CardDescription>{t("setup.summary.registerHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <Line label={t("setup.summary.registerPayments")} value={`${r.register.payments} · ${rs(r.register.amount)}`} />
              <Line label={t("setup.summary.registerMembers")} value={String(r.register.members)} />
              {r.register.from && r.register.to ? (
                <Line label={t("setup.summary.registerMonths")} value={`${formatMonth(r.register.from, locale)} – ${formatMonth(r.register.to, locale)}`} />
              ) : null}
              <Line label={t("setup.summary.registerCases")} value={`${r.registerCases.count} · ${rs(r.registerCases.amount)}`} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          {completedAt ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" />
              {t("setup.summary.doneOn", { date: formatDateTime(completedAt, locale) })}
            </p>
          ) : null}
          {firstMonth ? (
            <p className="text-sm text-muted-foreground">
              {locked ? t("setup.summary.lockedNext") : t("setup.summary.next", { month: formatMonth(firstMonth, locale) })}
            </p>
          ) : (
            <p className="text-sm text-destructive">{t("serverErrors.setFirstMonthFirst")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {!completedAt && !locked ? (
              <Button size="lg" disabled={!firstMonth} onClick={() => setConfirming(true)}>
                <CheckCircle2Icon />
                {t("setup.summary.markDone")}
              </Button>
            ) : null}
            {firstMonth ? (
              <Button asChild variant="outline" size="lg">
                <Link href={`/manage/closing?month=${firstMonth}`}>
                  <CalendarCheckIcon />
                  {t("setup.summary.openClosing")}
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("setup.summary.markDoneTitle")}
        description={t("setup.summary.markDoneBody")}
        confirmLabel={t("setup.summary.markDone")}
        onConfirm={() => completeSetupAction()}
        onDone={() => toast.success(t("setup.summary.marked"))}
      />
    </div>
  );
}
