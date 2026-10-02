"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { KeyRoundIcon, MoreVerticalIcon, PencilIcon, PlusIcon, SearchIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resetPasswordAction, setUserStatusAction, type TempPasswordResult } from "@/app/manage/users/actions";
import { formatDate } from "@/lib/dates";
import { ROLES, type Role } from "@/lib/roles";
import { formatMobile, normalizeMobile } from "@/lib/validators";
import type { MemberLinkOption } from "@/server/members";
import type { UserListItem } from "@/server/users";
import { TempPasswordDialog } from "./temp-password-dialog";
import { UserFormDialog } from "./user-form-dialog";

type RoleFilter = "all" | Role;

type UsersViewProps = {
  users: UserListItem[];
  memberOptions: MemberLinkOption[];
  currentUserId: string;
};

type Pending =
  | { kind: "form"; user: UserListItem | null }
  | { kind: "disable" | "enable" | "reset"; user: UserListItem }
  | null;

export function UsersView({ users, memberOptions, currentUserId }: UsersViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [pending, setPending] = useState<Pending>(null);
  const [tempResult, setTempResult] = useState<TempPasswordResult | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qMobile = normalizeMobile(q);
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (qMobile.length > 0 && u.mobile.includes(qMobile)) ||
        (u.memberNo?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [users, query, roleFilter]);

  const close = () => setPending(null);

  const lastLogin = (u: UserListItem) => (u.lastLoginAt ? formatDate(u.lastLoginAt, locale === "ur" ? "ur" : "en") : t("users.never"));

  function actionsFor(u: UserListItem) {
    const isSelf = u.id === currentUserId;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label={t("users.actions.menu", { name: u.name })}>
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setPending({ kind: "form", user: u })}>
            <PencilIcon />
            {t("users.actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPending({ kind: "reset", user: u })}>
            <KeyRoundIcon />
            {t("users.actions.resetPassword")}
          </DropdownMenuItem>
          {isSelf ? null : (
            <>
              <DropdownMenuSeparator />
              {u.status === "active" ? (
                <DropdownMenuItem variant="destructive" onSelect={() => setPending({ kind: "disable", user: u })}>
                  <UserXIcon />
                  {t("users.actions.disable")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setPending({ kind: "enable", user: u })}>
                  <UserCheckIcon />
                  {t("users.actions.enable")}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function badges(u: UserListItem) {
    return (
      <>
        <Badge variant={u.role === "member" ? "outline" : "secondary"}>{t(`roles.${u.role}`)}</Badge>
        {u.status === "disabled" ? <Badge variant="destructive">{t("userStatus.disabled")}</Badge> : null}
        {u.mustChangePassword && u.status === "active" ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
            {t("users.mustChange")}
          </Badge>
        ) : null}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("users.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("users.subtitle")} · {t("users.count", { count: users.length })}
          </p>
        </div>
        <Button size="lg" onClick={() => setPending({ kind: "form", user: null })}>
          <PlusIcon />
          {t("users.add")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("users.searchPlaceholder")}
            aria-label={t("common.search")}
            className="h-10 ps-9"
          />
        </div>
        <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
            {ROLES.map((role) => (
              <TabsTrigger key={role} value={role}>
                {t(`roles.${role}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("users.emptyTitle")} description={t("users.emptyBody")} />
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {filtered.map((u) => (
              <li key={u.id} className={`rounded-xl border bg-card p-3 ${u.status === "disabled" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-medium">{u.name}</span>
                    <span dir="ltr" className="self-start font-mono text-sm text-muted-foreground">
                      {formatMobile(u.mobile)}
                    </span>
                  </div>
                  {actionsFor(u)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges(u)}</div>
                <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t("users.member")}:{" "}
                    {u.memberNo ? (
                      <span dir="ltr" className="font-mono">{u.memberNo}</span>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span>
                    {t("users.lastLogin")}: {lastLogin(u)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Tablets and up: table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("users.form.name")}</TableHead>
                  <TableHead>{t("users.form.mobile")}</TableHead>
                  <TableHead>{t("users.form.role")}</TableHead>
                  <TableHead>{t("users.member")}</TableHead>
                  <TableHead>{t("users.lastLogin")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className={u.status === "disabled" ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>
                      <span dir="ltr" className="font-mono text-sm">{formatMobile(u.mobile)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">{badges(u)}</div>
                    </TableCell>
                    <TableCell>
                      {u.memberNo ? (
                        <span className="text-sm">
                          <span dir="ltr" className="font-mono text-xs">{u.memberNo}</span> · {u.memberName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lastLogin(u)}</TableCell>
                    <TableCell className="text-end">{actionsFor(u)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <UserFormDialog
        open={pending?.kind === "form"}
        onOpenChange={(open) => (open ? null : close())}
        user={pending?.kind === "form" ? pending.user : null}
        memberOptions={memberOptions}
        users={users}
        onCreated={setTempResult}
      />

      <ConfirmDialog
        open={pending?.kind === "reset"}
        onOpenChange={(open) => (open ? null : close())}
        title={t("users.confirmResetTitle", { name: pending?.user?.name ?? "" })}
        description={t("users.confirmResetBody")}
        confirmLabel={t("users.confirm")}
        onConfirm={() => resetPasswordAction(pending?.user?.id ?? "")}
        onDone={setTempResult}
      />

      <ConfirmDialog
        open={pending?.kind === "disable" || pending?.kind === "enable"}
        onOpenChange={(open) => (open ? null : close())}
        title={
          pending?.kind === "disable"
            ? t("users.confirmDisableTitle", { name: pending.user.name })
            : t("users.actions.enable")
        }
        description={pending?.kind === "disable" ? t("users.confirmDisableBody") : (pending?.user?.name ?? "")}
        confirmLabel={pending?.kind === "disable" ? t("users.actions.disable") : t("users.actions.enable")}
        destructive={pending?.kind === "disable"}
        onConfirm={() => setUserStatusAction(pending?.user?.id ?? "", pending?.kind === "enable")}
        onDone={(user) => toast.success(user.status === "active" ? t("users.enabled") : t("users.disabled"))}
      />

      <TempPasswordDialog result={tempResult} onClose={() => setTempResult(null)} />
    </div>
  );
}
