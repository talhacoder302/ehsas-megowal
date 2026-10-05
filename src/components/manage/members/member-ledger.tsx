"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { HandCoinsIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { waiveBillAction } from "@/app/manage/members/actions";
import type { BillStatus, LedgerRow } from "@/lib/contributions";
import { formatDate, formatMonth, formatMonthShort } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MemberLedger } from "@/server/ledger";

const BILL_BADGE: Record<BillStatus, string> = {
  paid: "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  partial: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  unpaid: "border-destructive/30 text-destructive",
  waived: "text-muted-foreground",
};

type WaiveTarget = { id: string; month: string; amount: number } | null;

export function MemberLedgerView({ ledger, memberId }: { ledger: MemberLedger; memberId: string }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [waive, setWaive] = useState<WaiveTarget>(null);
  // Newest first; the balance still runs oldest to newest.
  const rows = [...ledger.rows].reverse();

  const balanceText = (balance: number) =>
    balance < 0
      ? t("ledger.advanceBalance", { amount: formatRupees(-balance, locale) })
      : t("ledger.dueBalance", { amount: formatRupees(balance, locale) });

  function title(row: LedgerRow) {
    if (row.kind === "opening") return t("payments.openingDue");
    if (row.kind === "bill") return t("ledger.bill", { month: formatMonth(row.month, locale) });
    return t("ledger.payment", { receipt: row.receiptNumber });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-3">
          <span className="text-xs text-muted-foreground">{t("ledger.dueNow")}</span>
          <span className={cn("text-xl font-semibold", ledger.dueNow > 0 && "text-destructive")}>
            {formatRupees(ledger.dueNow, locale)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-3">
          <span className="text-xs text-muted-foreground">{t("ledger.totalPaid")}</span>
          <span className="text-xl font-semibold">{formatRupees(ledger.totalPaid, locale)}</span>
        </div>
        <div className="col-span-2 flex flex-col gap-1 rounded-xl border bg-card p-3 sm:col-span-1">
          <span className="text-xs text-muted-foreground">{t("ledger.advanceUntil")}</span>
          <span className="text-xl font-semibold">
            {ledger.advancePaidUntil ? formatMonth(ledger.advancePaidUntil, locale) : "—"}
          </span>
        </div>
      </div>

      {ledger.canReceive ? (
        <Button asChild size="lg" className="self-start">
          <Link href={`/manage/payments/new?member=${memberId}`}>
            <HandCoinsIcon />
            {t("payments.receive")}
          </Link>
        </Button>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon={WalletIcon} title={t("ledger.emptyTitle")} description={t("ledger.emptyBody")} />
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row) => {
            const voided = (row.kind === "bill" && row.status === "waived") || (row.kind === "payment" && row.cancelled);
            return (
              <li key={`${row.kind}-${row.id}`} className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.kind === "payment" && ledger.canReceive ? (
                        <Link href={`/manage/payments/${row.id}`} className="font-medium hover:underline">
                          {title(row)}
                        </Link>
                      ) : (
                        <span className="font-medium">{title(row)}</span>
                      )}
                      {row.kind === "bill" ? (
                        <Badge variant="outline" className={BILL_BADGE[row.status]}>
                          {t(`billStatus.${row.status}`)}
                        </Badge>
                      ) : null}
                      {row.kind === "payment" && row.cancelled ? (
                        <Badge variant="destructive">{t("receipt.cancelled")}</Badge>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.kind === "bill" ? t("ledger.billDate") : formatDate(row.date, locale)}
                      {row.kind === "bill" && row.status === "partial"
                        ? ` · ${t("ledger.paidSoFar", { amount: formatRupees(row.paidAmount, locale) })}`
                        : ""}
                    </span>
                    {row.kind === "payment" ? (
                      <span className="text-xs text-muted-foreground">
                        {[
                          row.openingDuePaid > 0 ? t("payments.openingDueShort") : null,
                          ...row.monthsCovered.map((m) => formatMonthShort(m, locale)),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    ) : null}
                    {row.kind === "bill" && row.status === "waived" && row.waivedReason ? (
                      <span className="text-xs">{t("ledger.waivedBecause", { reason: row.waivedReason })}</span>
                    ) : null}
                    {row.kind === "payment" && row.cancelled && row.cancelReason ? (
                      <span className="text-xs">{t("ledger.cancelledBecause", { reason: row.cancelReason })}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={cn(
                        "font-semibold",
                        voided && "text-muted-foreground line-through",
                        !voided && row.kind === "payment" && "text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {row.kind === "payment" ? "− " : "+ "}
                      {formatRupees(row.amount, locale)}
                    </span>
                    <span className="text-xs text-muted-foreground">{balanceText(row.balance)}</span>
                  </div>
                </div>
                {ledger.canWaive && row.kind === "bill" && row.status === "unpaid" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-muted-foreground"
                    onClick={() => setWaive({ id: row.id, month: row.month, amount: row.amount })}
                  >
                    {t("ledger.waive")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <ReasonDialog
        open={waive !== null}
        onOpenChange={(open) => (open ? null : setWaive(null))}
        title={t("ledger.waiveTitle", { month: waive ? formatMonth(waive.month, locale) : "" })}
        description={t("ledger.waiveBody", { amount: formatRupees(waive?.amount ?? 0, locale) })}
        confirmLabel={t("ledger.waive")}
        placeholder={t("ledger.waivePlaceholder")}
        onConfirm={(input) => waiveBillAction(waive?.id ?? "", input)}
        onDone={() => toast.success(t("ledger.waived"))}
      />
    </div>
  );
}
