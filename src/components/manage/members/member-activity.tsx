import { getLocale, getTranslations } from "next-intl/server";
import { HistoryIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { localeNames, isLocale } from "@/i18n/config";
import { formatDate, formatDateTime, parseDateKey } from "@/lib/dates";
import { MEMBER_STATUSES } from "@/lib/member-status";
import { isRole } from "@/lib/roles";
import { formatMobile } from "@/lib/validators";
import type { MemberActivityItem } from "@/server/members";

/** Activity tab of the member page. */
export async function MemberActivity({ items }: { items: MemberActivityItem[] }) {
  const t = await getTranslations();
  const locale = (await getLocale()) === "ur" ? "ur" : "en";

  if (items.length === 0) {
    return (
      <EmptyState icon={HistoryIcon} title={t("members.activity.emptyTitle")} description={t("members.activity.emptyBody")} />
    );
  }

  type ActionKey = Parameters<typeof t>[0];
  const label = (key: string, fallback: string) => (t.has(key as ActionKey) ? t(key as ActionKey) : fallback);

  const showDate = (key: string) => {
    const date = parseDateKey(key);
    return date ? formatDate(date, locale) : key;
  };

  const statusName = (value: string) =>
    (MEMBER_STATUSES as readonly string[]).includes(value) ? label(`memberStatus.${value}`, value) : value;

  function showValue(field: string, value: string): string {
    if (!value) return t("members.activity.emptyValue");
    if (field === "mobile") return formatMobile(value);
    if (field === "joinDate") return showDate(value);
    if (field === "role" && isRole(value)) return t(`roles.${value}`);
    if (field === "language" && isLocale(value)) return localeNames[value];
    return value;
  }

  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="font-medium">
              {label(`members.activity.actions.${item.action.replaceAll(".", "_")}`, t("members.activity.actions.other"))}
            </span>
            <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt, locale)}</span>
          </div>

          {item.statusChange ? (
            <div className="flex flex-col gap-0.5">
              <span>
                {statusName(item.statusChange.from)} <span className="rtl:-scale-x-100 inline-block">→</span>{" "}
                {statusName(item.statusChange.to)} ·{" "}
                {t("members.activity.from", { date: showDate(item.statusChange.date) })}
              </span>
              <span className="text-muted-foreground">{item.statusChange.reason}</span>
            </div>
          ) : null}

          {item.changes.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {item.changes
                .filter((c) => c.field !== "memberId")
                .map((c) => (
                  <li key={c.field} className="text-muted-foreground">
                    <span className="text-foreground">{label(`members.activity.fields.${c.field}`, c.field)}:</span>{" "}
                    <span className="line-through decoration-muted-foreground/50">{showValue(c.field, c.from)}</span>{" "}
                    <span className="rtl:-scale-x-100 inline-block">→</span> {showValue(c.field, c.to)}
                  </li>
                ))}
            </ul>
          ) : null}

          <span className="text-xs text-muted-foreground">
            {t("members.activity.by", { name: item.actorName ?? t("members.activity.system") })}
          </span>
        </li>
      ))}
    </ol>
  );
}
