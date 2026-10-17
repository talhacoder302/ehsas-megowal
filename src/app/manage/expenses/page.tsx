import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExpensesView } from "@/components/manage/expenses/expenses-view";
import { todayKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listAccountOptions } from "@/server/accounts";
import { requirePageUser } from "@/server/auth/guards";
import { listExpenses } from "@/server/expenses";
import { uploadsEnabled } from "@/server/storage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses");
  return { title: t("title") };
}

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export default async function ExpensesPage({ searchParams }: Props) {
  const me = await requirePageUser("/manage/expenses");
  if (!can(me.role, "expenses.manage")) redirect("/manage");
  const { page } = await searchParams;
  const [data, accounts] = await Promise.all([listExpenses(page), listAccountOptions()]);
  return <ExpensesView data={data} accounts={accounts} uploadsEnabled={uploadsEnabled()} today={todayKey()} />;
}
