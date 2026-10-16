"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2Icon, SearchIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { MemberStatusBadge } from "@/components/manage/members/member-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveMemberOpeningsAction } from "@/app/manage/setup/actions";
import { parseDateKey, type DateKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees, parseRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SetupMember } from "@/server/setup";

type Row = { joinDate: string; openingDue: string };

/** Step 3: each member's join date and what they still owed in the register before the first month. */
export function MembersStep({ members, locked, today }: { members: SetupMember[]; locked: boolean; today: DateKey }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(members.map((m) => [m.id, { joinDate: m.joinDate, openingDue: String(m.openingDue) }])),
  );
  const [query, setQuery] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, ServerErrorCode>>({});
  const [error, setError] = useState<ServerErrorCode | null>(null);
  const [saving, setSaving] = useState(false);

  const original = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const changed = members.filter((m) => rows[m.id].joinDate !== m.joinDate || rows[m.id].openingDue !== String(m.openingDue));
  const invalid = new Set(
    changed.filter((m) => parseRupees(rows[m.id].openingDue) === null || !parseDateKey(rows[m.id].joinDate) || rows[m.id].joinDate > today).map((m) => m.id),
  );
  const total = members.reduce((sum, m) => sum + (parseRupees(rows[m.id].openingDue) ?? 0), 0);
  const q = query.trim().toLowerCase();
  const shown = q
    ? members.filter((m) => `${m.memberNo} ${m.name} ${m.fatherName}`.toLowerCase().includes(q))
    : members;

  const update = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  async function save() {
    setError(null);
    setSaving(true);
    const result = await saveMemberOpeningsAction({
      members: changed.map((m) => ({ memberId: m.id, joinDate: rows[m.id].joinDate, openingDue: rows[m.id].openingDue })),
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setRowErrors(Object.fromEntries(result.data.errors.map((e) => [e.memberId, e.code])));
    if (result.data.errors.length === 0) {
      toast.success(t("setup.members.saved", { count: result.data.saved }));
      router.push("/manage/setup?step=4");
    } else {
      toast.error(t("setup.members.someFailed", { saved: result.data.saved, failed: result.data.errors.length }));
      router.refresh();
    }
  }

  if (members.length === 0) {
    return <EmptyState icon={UsersIcon} title={t("setup.members.none")} description={t("setup.members.noneHint")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("setup.members.search")} className="h-10 ps-9" />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
          <span className="text-sm text-muted-foreground">{t("setup.members.total")}</span>
          <span className="text-lg font-semibold">{formatRupees(total, locale)}</span>
        </div>
      </div>
      <FormError code={error} />

      <ul className="flex flex-col gap-2">
        {shown.map((m) => {
          const row = rows[m.id];
          const dirty = changed.includes(m);
          const paid = original.get(m.id)?.openingDuePaid ?? 0;
          return (
            <li key={m.id}>
              <Card className={cn("gap-2 py-3", dirty && "border-primary/50", rowErrors[m.id] && "border-destructive/50")}>
                <CardContent className="flex flex-col gap-2 px-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span dir="ltr" lang="en" className="font-mono text-xs">
                      {m.memberNo}
                    </span>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.fatherName}</span>
                    {m.status !== "active" ? <MemberStatusBadge status={m.status} /> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {t("members.fields.joinDate")}
                      <Input
                        type="date"
                        dir="ltr"
                        max={today}
                        value={row.joinDate}
                        disabled={locked}
                        onChange={(e) => update(m.id, { joinDate: e.target.value })}
                        className="h-9"
                        aria-invalid={invalid.has(m.id)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {t("setup.members.openingDue")}
                      <Input
                        inputMode="numeric"
                        dir="ltr"
                        value={row.openingDue}
                        disabled={locked}
                        onChange={(e) => update(m.id, { openingDue: e.target.value })}
                        className="h-9"
                        aria-invalid={invalid.has(m.id)}
                      />
                    </label>
                  </div>
                  {paid > 0 ? <span className="text-xs text-muted-foreground">{t("setup.members.paidSince", { amount: formatRupees(paid, locale) })}</span> : null}
                  {rowErrors[m.id] ? <FormError code={rowErrors[m.id]} /> : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <Button size="lg" disabled={locked || saving || changed.length === 0 || invalid.size > 0} onClick={save}>
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          {t("setup.members.save", { count: changed.length })}
        </Button>
        <span className="text-xs text-muted-foreground">{t("setup.members.hint")}</span>
      </div>
    </div>
  );
}
