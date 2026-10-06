import { getLocale, getTranslations } from "next-intl/server";
import { CaseStatusBadge } from "@/components/shared/case-badges";
import { formatDateTime } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CaseTimelineEntry } from "@/server/cases";

/** Vertical status history, newest at the top, with reasons, who and when. */
export async function CaseTimeline({ entries }: { entries: CaseTimelineEntry[] }) {
  const t = await getTranslations();
  const locale = (await getLocale()) === "ur" ? "ur" : "en";

  return (
    <ol className="relative flex flex-col">
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        return (
          <li key={`${e.changedAt}-${e.status}`} className="relative flex gap-3 pb-5 last:pb-0">
            {/* The line joining the dots. */}
            {last ? null : <span aria-hidden className="absolute start-[0.6875rem] top-6 bottom-0 w-px bg-border" />}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                i === 0 ? "border-primary" : "border-border",
              )}
            >
              <span className={cn("size-2 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/40")} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <CaseStatusBadge status={e.status} />
                <span className="text-xs text-muted-foreground">{formatDateTime(e.changedAt, locale)}</span>
              </div>
              <p dir="auto" className="text-sm">{e.reason || (last ? t("cases.timeline.created") : "")}</p>
              {e.approvedAmount !== null ? (
                <p className="text-sm font-medium">{t("cases.timeline.approvedAmount", { amount: formatRupees(e.approvedAmount, locale) })}</p>
              ) : null}
              {e.changedByName ? <span className="text-xs text-muted-foreground">{t("cases.timeline.by", { name: e.changedByName })}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
