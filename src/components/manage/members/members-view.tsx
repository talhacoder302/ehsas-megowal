"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FileSpreadsheetIcon, PlusIcon, SearchIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/member-status";
import { formatRupees } from "@/lib/money";
import { formatMobile, mobileSearchDigits } from "@/lib/validators";
import type { MemberListItem } from "@/server/members";
import { MemberStatusBadge } from "./member-status-badge";

type StatusFilter = "all" | MemberStatus;

type MembersViewProps = {
  members: MemberListItem[];
  canManage: boolean;
};

export function MembersView({ members, canManage }: MembersViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const byStatus: Record<StatusFilter, number> = { all: members.length, active: 0, left: 0, deceased: 0, exempt: 0 };
    for (const m of members) byStatus[m.status] += 1;
    return byStatus;
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qMobile = mobileSearchDigits(q);
    return members.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.fatherName.toLowerCase().includes(q) ||
        m.memberNo.toLowerCase().includes(q) ||
        (qMobile !== null && m.mobile.includes(qMobile))
      );
    });
  }, [members, query, status]);

  const pending = (m: MemberListItem) =>
    m.pendingAmount === null ? (
      <span className="text-muted-foreground" title={t("members.pendingSoon")}>
        —
      </span>
    ) : (
      formatRupees(m.pendingAmount, locale === "ur" ? "ur" : "en")
    );

  const exportHref = `/api/members/export${status === "all" ? "" : `?status=${status}`}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("members.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("members.subtitle")} · {t("members.count", { count: counts.all })}
          </p>
        </div>
        <div className="flex gap-2">
          {members.length > 0 ? (
            <Button asChild variant="outline" size="lg">
              <a href={exportHref} download aria-label={t("members.exportLabel")} title={t("members.exportLabel")}>
                <FileSpreadsheetIcon />
                {t("members.export")}
              </a>
            </Button>
          ) : null}
          {canManage ? (
            <Button asChild size="lg">
              <Link href="/manage/members/new">
                <PlusIcon />
                {t("members.add")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={t("members.noMembersTitle")}
          description={t("members.noMembersBody")}
          action={
            canManage ? (
              <Button asChild size="lg">
                <Link href="/manage/members/new">
                  <PlusIcon />
                  {t("members.add")}
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("members.searchPlaceholder")}
                aria-label={t("common.search")}
                className="h-10 ps-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="h-10 w-full sm:w-48" aria-label={t("members.statusFilter")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("members.allStatuses")} ({counts.all})
                </SelectItem>
                {MEMBER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`memberStatus.${s}`)} ({counts[s]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t("members.emptyTitle")} description={t("members.emptyBody")} />
          ) : (
            <>
              {/* Phones: cards */}
              <ul className="flex flex-col gap-2 md:hidden">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/manage/members/${m.id}`}
                      className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                            {m.memberNo}
                          </span>
                          <MemberStatusBadge status={m.status} />
                        </div>
                        <span className="truncate font-medium">{m.name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {t("members.sonOf", { name: m.fatherName })} · {m.mohalla}
                        </span>
                        {m.mobile ? (
                          <span dir="ltr" className="self-start font-mono text-xs text-muted-foreground">
                            {formatMobile(m.mobile)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                        <span className="text-xs text-muted-foreground">{t("members.columns.pending")}</span>
                        {pending(m)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Tablets and up: table */}
              <div className="hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">{t("members.columns.memberNo")}</TableHead>
                      <TableHead>{t("members.columns.name")}</TableHead>
                      <TableHead>{t("members.columns.mohalla")}</TableHead>
                      <TableHead>{t("members.columns.mobile")}</TableHead>
                      <TableHead>{t("members.columns.status")}</TableHead>
                      <TableHead className="text-end">{t("members.columns.pending")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => (
                      // The name link stretches over the whole row, so any click opens the member.
                      <TableRow key={m.id} className="relative cursor-pointer">
                        <TableCell>
                          <span dir="ltr" className="font-mono text-xs">{m.memberNo}</span>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/manage/members/${m.id}`}
                            className="flex flex-col after:absolute after:inset-0 focus-visible:outline-none"
                          >
                            <span className="font-medium">{m.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {t("members.sonOf", { name: m.fatherName })}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{m.mohalla}</TableCell>
                        <TableCell>
                          {m.mobile ? (
                            <span dir="ltr" className="font-mono text-sm">{formatMobile(m.mobile)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <MemberStatusBadge status={m.status} />
                        </TableCell>
                        <TableCell className="text-end">{pending(m)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filtered.every((m) => m.pendingAmount === null) ? (
                <p className="text-xs text-muted-foreground">{t("members.pendingSoon")}</p>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
