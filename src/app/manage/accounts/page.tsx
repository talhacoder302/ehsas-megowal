import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AccountsView } from "@/components/manage/accounts/accounts-view";
import { todayKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listAccountOptions, listAccounts, listStaffOptions } from "@/server/accounts";
import { listTransfers } from "@/server/expenses";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts");
  return { title: t("title") };
}

export default async function AccountsPage() {
  const me = await requirePageUser("/manage/accounts");
  if (!can(me.role, "accounts.manage")) redirect("/manage");

  const [accounts, staff, transfers, options] = await Promise.all([
    listAccounts(),
    listStaffOptions(),
    listTransfers(),
    listAccountOptions(),
  ]);
  return <AccountsView accounts={accounts} staff={staff} transfers={transfers} options={options} today={todayKey()} />;
}
