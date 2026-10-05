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

export default async function PaymentsPage() {
  const me = await requirePageUser("/manage/payments");
  if (!can(me.role, "payments.record")) redirect("/manage");
  return <PaymentsView payments={await listPayments()} />;
}
