"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { KeyRoundIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { TempPasswordDialog } from "@/components/manage/temp-password-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createMemberLoginAction, type MemberLoginShare } from "@/app/manage/members/actions";
import { formatDate } from "@/lib/dates";
import type { MemberStatus } from "@/lib/member-status";
import { formatMobile } from "@/lib/validators";
import type { MemberLogin } from "@/server/members";

type MemberLoginPanelProps = {
  member: { id: string; name: string; mobile: string; status: MemberStatus };
  login: MemberLogin | null;
  canManage: boolean;
  isAdmin: boolean;
};

/**
 * The member's app login, or a button to create one. Stays mounted after the
 * login is created (the page refreshes) so the temporary password dialog
 * is not lost.
 */
export function MemberLoginPanel({ member, login, canManage, isAdmin }: MemberLoginPanelProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [confirming, setConfirming] = useState(false);
  const [share, setShare] = useState<MemberLoginShare | null>(null);

  let body: React.ReactNode;
  if (login) {
    const rows: { label: string; value: React.ReactNode }[] = [
      { label: t("members.login.mobile"), value: <span dir="ltr" className="font-mono">{formatMobile(login.mobile)}</span> },
      { label: t("members.login.role"), value: <Badge variant="secondary">{t(`roles.${login.role}`)}</Badge> },
      {
        label: t("members.login.status"),
        value:
          login.status === "active" ? (
            <Badge variant="outline">{t("userStatus.active")}</Badge>
          ) : (
            <Badge variant="destructive">{t("userStatus.disabled")}</Badge>
          ),
      },
      {
        label: t("members.login.lastLogin"),
        value: login.lastLoginAt ? formatDate(login.lastLoginAt, locale) : t("members.login.never"),
      },
    ];
    body = (
      <div className="flex flex-col gap-3">
        <dl className="divide-y">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-end font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
        {login.mustChangePassword && login.status === "active" ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
            {t("members.login.mustChange")}
          </Badge>
        ) : null}
        {isAdmin ? (
          <Link href="/manage/users" className="text-sm text-primary underline-offset-4 hover:underline">
            {t("manage.nav.users")}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">{t("members.login.adminNote")}</p>
        )}
      </div>
    );
  } else {
    let action: React.ReactNode = null;
    if (canManage && member.status === "deceased") {
      action = <p className="text-sm text-muted-foreground">{t("members.login.deceased")}</p>;
    } else if (canManage && !member.mobile) {
      action = (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("members.login.needsMobile")}</p>
          <Button asChild variant="outline" size="lg" className="self-start">
            <Link href={`/manage/members/${member.id}/edit`}>
              <PencilIcon />
              {t("members.edit")}
            </Link>
          </Button>
        </div>
      );
    } else if (canManage) {
      action = (
        <Button size="lg" className="self-start" onClick={() => setConfirming(true)}>
          <KeyRoundIcon />
          {t("members.login.create")}
        </Button>
      );
    }
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{t("members.login.none")}</p>
        {action}
      </div>
    );
  }

  return (
    <>
      {body}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("members.login.confirmTitle", { name: member.name })}
        description={t("members.login.confirmBody", { mobile: formatMobile(member.mobile) })}
        confirmLabel={t("members.login.create")}
        onConfirm={() => createMemberLoginAction(member.id)}
        onDone={(result) => {
          toast.success(t("members.login.created"));
          setShare(result);
        }}
      />

      <TempPasswordDialog result={share} onClose={() => setShare(null)} />
    </>
  );
}
