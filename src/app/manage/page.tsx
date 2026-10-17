import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardListIcon, HourglassIcon, WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/manage/page-header";
import { BudgetCard } from "@/components/manage/budget-card";
import { ActivityCard } from "@/components/manage/dashboard/activity-card";
import { CasesCard } from "@/components/manage/dashboard/cases-card";
import { CollectionCard } from "@/components/manage/dashboard/collection-card";
import { PendingApprovals } from "@/components/manage/pending-approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupees } from "@/lib/money";
import { can } from "@/lib/permissions";
import { listAccounts } from "@/server/accounts";
import { requirePageUser } from "@/server/auth/guards";
import { getBudget } from "@/server/closing";
import { getDashboard } from "@/server/dashboard";
import { setupNeeded } from "@/server/setup";
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
  const seesMoney = can(me.role, "accounts.manage");
  const [pending, accounts, budget, needsSetup, dashboard] = await Promise.all([
    canApprove ? listPendingDisbursements() : Promise.resolve([]),
    seesMoney ? listAccounts() : Promise.resolve([]),
    seesMoney ? getBudget() : Promise.resolve(null),
    can(me.role, "setup.manage") ? setupNeeded() : Promise.resolve(false),
    getDashboard(),
  ]);
  const active = accounts.filter((a) => a.active);
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={t("manage.dashboard.title")} subtitle={t("manage.dashboard.subtitle")} />

      {needsSetup ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ClipboardListIcon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{t("setup.dashboardTitle")}</span>
                <span className="text-sm text-muted-foreground">{t("setup.dashboardBody")}</span>
              </div>
            </div>
            <Button asChild size="lg" className="self-start sm:self-auto">
              <Link href="/manage/setup">{t("setup.dashboardButton")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {budget ? <BudgetCard budget={budget} lang={lang} canClose={can(me.role, "months.close")} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CollectionCard data={dashboard.collection} lang={lang} />
        <CasesCard data={dashboard.cases} />
      </div>

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

      {dashboard.activity ? <ActivityCard entries={dashboard.activity} lang={lang} /> : null}
    </div>
  );
}
