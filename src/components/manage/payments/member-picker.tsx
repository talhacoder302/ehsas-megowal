"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRightIcon, SearchIcon } from "lucide-react";
import { MemberStatusBadge } from "@/components/manage/members/member-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { formatRupees } from "@/lib/money";
import { formatMobile, mobileSearchDigits } from "@/lib/validators";
import type { MemberListItem } from "@/server/members";

/** First step of "Receive payment": find the member. Picking one opens ?member=<id>. */
export function MemberPicker({ members }: { members: MemberListItem[] }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = mobileSearchDigits(q);
    const list = q
      ? members.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.fatherName.toLowerCase().includes(q) ||
            m.memberNo.toLowerCase().includes(q) ||
            (digits !== null && m.mobile.includes(digits)),
        )
      : members;
    // Deceased members rarely pay; keep them at the end.
    return [...list].sort((a, b) => Number(a.status === "deceased") - Number(b.status === "deceased"));
  }, [members, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("members.searchPlaceholder")}
          aria-label={t("common.search")}
          className="h-11 ps-9 text-base"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("members.emptyTitle")} description={t("payments.pickNoMatch")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.slice(0, 50).map((m) => (
            <li key={m.id}>
              <Link
                href={`/manage/payments/new?member=${m.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                      {m.memberNo}
                    </span>
                    {m.status === "active" ? null : <MemberStatusBadge status={m.status} />}
                  </div>
                  <span className="truncate font-medium">{m.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("members.sonOf", { name: m.fatherName })}
                    {m.mobile ? (
                      <>
                        {" · "}
                        <span dir="ltr">{formatMobile(m.mobile)}</span>
                      </>
                    ) : null}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-xs text-muted-foreground">{t("members.columns.pending")}</span>
                  <span className={m.pendingAmount ? "font-semibold text-destructive" : "text-muted-foreground"}>
                    {formatRupees(m.pendingAmount ?? 0, locale)}
                  </span>
                </div>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
