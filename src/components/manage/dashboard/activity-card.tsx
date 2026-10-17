import { getTranslations } from "next-intl/server";
import { HistoryIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { formatDateTime, formatMonth, isMonthKey } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { ActivityEntry } from "@/server/dashboard";

/** The last few things anyone did, newest first. */
export async function ActivityCard({ entries, lang }: { entries: ActivityEntry[]; lang: Locale }) {
  const t = await getTranslations("dashboard.activity");

  const label = (action: string) => {
    const key = `actions.${action.replace(/\./g, "_")}`;
    return t.has(key as Parameters<typeof t.has>[0]) ? t(key as Parameters<typeof t>[0]) : action;
  };
  const facts = (e: ActivityEntry) =>
    [
      e.caseNo,
      e.receiptNumber,
      e.name,
      e.month && isMonthKey(e.month) ? formatMonth(e.month, lang) : null,
      e.amount !== null ? formatRupees(e.amount, lang) : null,
    ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="size-5 text-primary" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ol className="flex flex-col gap-3 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 border-s-2 border-primary/30 ps-3">
                <span className="font-medium">{label(e.action)}</span>
                {facts(e).length > 0 ? (
                  <span dir="auto" className="text-xs">
                    {facts(e).join(" · ")}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {e.actorName ?? t("system")} · {formatDateTime(e.createdAt, lang)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
