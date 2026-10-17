import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PaymentsView } from "@/components/manage/payments/payments-view";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listPayments } from "@/server/payments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payments");
  return { title: t("title") };
}

type Props = { searchParams: Promise<{ q?: string | string[]; cancelled?: string | string[]; page?: string | string[] }> };

export default async function PaymentsPage({ searchParams }: Props) {
  const me = await requirePageUser("/manage/payments");
  if (!can(me.role, "payments.record")) redirect("/manage");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const showCancelled = params.cancelled === "1";
  const data = await listPayments({ q, cancelled: showCancelled, page: params.page });
  return <PaymentsView key={`${q}|${showCancelled}`} data={data} q={q} showCancelled={showCancelled} />;
}
