import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HandCoinsIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { formatMonth } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { DashboardCollection } from "@/server/dashboard";

/** This month: collected against what the bills ask for, and who still owes. */
export async function CollectionCard({ data, lang }: { data: DashboardCollection; lang: Locale }) {
  const t = await getTranslations("dashboard");
  const share = data.expected > 0 ? Math.min(1, data.collected / data.expected) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandCoinsIcon className="size-5 text-primary" />
          {t("collectionTitle", { month: formatMonth(data.month, lang) })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{t("collected")}</span>
            <span className="text-2xl font-semibold">{formatRupees(data.collected, lang)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground">{data.billsGenerated ? t("expected") : t("expectedEstimate")}</span>
            <span className="text-lg font-medium">{formatRupees(data.expected, lang)}</span>
          </div>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t("collected")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={data.percent ?? 0}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {data.percent === null ? t("noBillsYet") : t("collectedPercent", { percent: data.percent })}
        </p>
        <Link
          href="/manage/pending"
          className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
        >
          <span>{t("pendingMembers", { count: data.pendingMembers })}</span>
          <span className="font-semibold text-destructive">{formatRupees(data.pendingAmount, lang)}</span>
        </Link>
      </CardContent>
    </Card>
  );
}
