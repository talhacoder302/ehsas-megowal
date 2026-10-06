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

export default async function ExpensesPage() {
  const me = await requirePageUser("/manage/expenses");
  if (!can(me.role, "expenses.manage")) redirect("/manage");
  const [expenses, accounts] = await Promise.all([listExpenses(), listAccountOptions()]);
  return <ExpensesView expenses={expenses} accounts={accounts} uploadsEnabled={uploadsEnabled()} today={todayKey()} />;
}
