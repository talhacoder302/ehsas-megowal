"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from "recharts";
import { formatMonth, formatMonthShort } from "@/lib/dates";
import { formatNumber, formatRupees } from "@/lib/money";
import type { ChartPoint } from "@/server/reports";

// Colours are --chart-1 (collection) and --chart-2 (aid), checked for colour
// blindness and contrast in light and dark mode. Text never uses them.
const SERIES = [
  { key: "collection", color: "var(--chart-1)" },
  { key: "aid", color: "var(--chart-2)" },
] as const;

/** "12k", "1.2 lac" style labels keep the axis narrow on phones. */
function compact(value: number): string {
  if (value >= 100_000) return `${formatNumber(Math.round(value / 10_000) / 10)}L`;
  if (value >= 1_000) return `${formatNumber(Math.round(value / 1_000))}k`;
  return formatNumber(value);
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<TooltipValueType, string | number>) {
  const t = useTranslations("reports");
  const locale = useLocale() === "ur" ? "ur" : "en";
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{formatMonth(String(label), locale)}</p>
      {SERIES.map((s) => {
        const value = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <p key={s.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.key === "collection" ? t("chartCollection") : t("chartAid")}
            </span>
            <span className="font-medium">{formatRupees(Number(value), locale)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Last 12 months: collection next to aid given, one bar each per month. */
export function ReportChart({ points }: { points: ChartPoint[] }) {
  const t = useTranslations("reports");
  const locale = useLocale() === "ur" ? "ur" : "en";
  const hasData = points.some((p) => p.collection > 0 || p.aid > 0);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.key === "collection" ? t("chartCollection") : t("chartAid")}
          </li>
        ))}
      </ul>

      {hasData ? (
        // Months read left to right in both languages, like the PDF and printed calendars.
        <div dir="ltr" className="h-56 w-full" role="img" aria-label={`${t("chartTitle")}, ${t("chartSubtitle")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickFormatter={(m: string) => formatMonthShort(m, "en").split(" ")[0]}
                interval="preserveStartEnd"
                minTickGap={4}
              />
              <YAxis
                width={40}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickFormatter={compact}
              />
              <Tooltip content={ChartTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("chartEmpty")}</p>
      )}

      {hasData ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">{t("chartTable")}</summary>
          <table className="mt-2 w-full">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-start font-normal">{t("month")}</th>
                <th className="py-1 text-end font-normal">{t("chartCollection")}</th>
                <th className="py-1 text-end font-normal">{t("chartAid")}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.month} className="border-t">
                  <td className="py-1">{formatMonth(p.month, locale)}</td>
                  <td className="py-1 text-end">{formatRupees(p.collection, locale)}</td>
                  <td className="py-1 text-end">{formatRupees(p.aid, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}
