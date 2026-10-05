import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AccountsView } from "@/components/manage/accounts/accounts-view";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listAccounts, listStaffOptions } from "@/server/accounts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounts");
  return { title: t("title") };
}

export default async function AccountsPage() {
  const me = await requirePageUser("/manage/accounts");
  if (!can(me.role, "accounts.manage")) redirect("/manage");

  const [accounts, staff] = await Promise.all([listAccounts(), listStaffOptions()]);
  return <AccountsView accounts={accounts} staff={staff} />;
}
