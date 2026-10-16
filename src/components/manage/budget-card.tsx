import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarCheckIcon, PiggyBankIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { formatMonth } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Budget } from "@/server/closing";

/** Dashboard: money held, promised, kept aside and free to spend. */
export async function BudgetCard({ budget, lang, canClose }: { budget: Budget; lang: Locale; canClose: boolean }) {
  const t = await getTranslations("dashboard");
  const tiles = [
    { label: t("budgetBalance"), amount: budget.balance },
    { label: t("budgetCommitted"), amount: budget.committed, minus: true },
    { label: t("budgetReserve"), amount: budget.reserve, minus: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBankIcon className="size-5 text-primary" />
          {t("budgetTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex items-center justify-between gap-2 rounded-lg border p-3 sm:flex-col sm:items-start">
              <span className="text-sm text-muted-foreground">{tile.label}</span>
              <span className="text-lg font-semibold">
                {tile.minus ? "− " : ""}
                {formatRupees(tile.amount, lang)}
              </span>
            </div>
          ))}
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg p-3 sm:flex-col sm:items-start",
              budget.free < 0 ? "bg-destructive/10" : "bg-primary/10",
            )}
          >
            <span className="text-sm font-medium">{t("budgetFree")}</span>
            <span className={cn("text-2xl font-semibold", budget.free < 0 && "text-destructive")}>{formatRupees(budget.free, lang)}</span>
          </div>
        </div>
        <p className={cn("text-xs", budget.free < 0 ? "text-destructive" : "text-muted-foreground")}>
          {budget.free < 0 ? t("budgetNegative") : t("budgetFreeHint")}
        </p>
        {budget.monthToClose && canClose ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-amber-500/10 p-3 text-sm">
            <CalendarCheckIcon className="size-4 text-amber-600" />
            <span>{t("closeReminder", { month: formatMonth(budget.monthToClose, lang) })}</span>
            <Link href={`/manage/closing?month=${budget.monthToClose}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {t("closeNow")}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
