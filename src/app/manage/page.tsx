import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HourglassIcon, WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/manage/page-header";
import { PendingApprovals } from "@/components/manage/pending-approvals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupees } from "@/lib/money";
import { can } from "@/lib/permissions";
import { listAccounts } from "@/server/accounts";
import { requirePageUser } from "@/server/auth/guards";
import { listPendingDisbursements } from "@/server/disbursements";
import { readSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.dashboard");
  return { title: t("title") };
}

export default async function ManageDashboardPage() {
  const me = await requirePageUser("/manage");
  const [t, locale, settings] = await Promise.all([getTranslations(), getLocale(), readSettings()]);
  const lang = locale === "ur" ? "ur" : "en";
  const canApprove = can(me.role, "disbursements.approve");
  const [pending, accounts] = await Promise.all([
    canApprove ? listPendingDisbursements() : Promise.resolve([]),
    can(me.role, "accounts.manage") ? listAccounts() : Promise.resolve([]),
  ]);
  const active = accounts.filter((a) => a.active);
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={t("manage.dashboard.title")} subtitle={t("manage.dashboard.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-2">
        {canApprove ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HourglassIcon className="size-5 text-amber-600" />
                {t("dashboard.waitingTitle")}
                {pending.length > 0 ? <Badge className="bg-amber-500 text-white">{pending.length}</Badge> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {settings.approval.enabled
                  ? t("dashboard.approvalOn", { limit: formatRupees(settings.approval.limit, lang) })
                  : t("dashboard.approvalOff")}
              </p>
              <PendingApprovals items={pending} />
            </CardContent>
          </Card>
        ) : null}

        {active.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletIcon className="size-5 text-primary" />
                {t("dashboard.balancesTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
                <span className="text-sm text-muted-foreground">{t("accounts.totalBalance")}</span>
                <span className="text-2xl font-semibold">{formatRupees(total, lang)}</span>
              </div>
              <ul className="divide-y text-sm">
                {active.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{t(`accountType.${a.type}`)}</span>
                    </span>
                    <span className="font-semibold">{formatRupees(a.balance, lang)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/manage/accounts" className="self-start text-sm text-primary underline-offset-4 hover:underline">
                {t("dashboard.openAccounts")}
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
