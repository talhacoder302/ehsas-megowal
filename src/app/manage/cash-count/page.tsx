import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CashCountView } from "@/components/manage/cash-count/cash-count-view";
import { can } from "@/lib/permissions";
import { listAccountOptions } from "@/server/accounts";
import { requirePageUser } from "@/server/auth/guards";
import { listCashCounts } from "@/server/cash-counts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cashCount");
  return { title: t("title") };
}

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export default async function CashCountPage({ searchParams }: Props) {
  const me = await requirePageUser("/manage/cash-count");
  if (!can(me.role, "cash.count")) redirect("/manage");
  const { page } = await searchParams;
  const [accounts, counts] = await Promise.all([listAccountOptions(), listCashCounts(page)]);
  const mine = accounts.find((a) => a.holderUserId === me.id);
  return <CashCountView accounts={accounts} counts={counts} defaultAccountId={mine?.id ?? null} />;
}
