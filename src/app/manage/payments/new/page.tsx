import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/manage/page-header";
import { MemberPicker } from "@/components/manage/payments/member-picker";
import { PaymentForm } from "@/components/manage/payments/payment-form";
import { todayKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listMembers } from "@/server/members";
import { getPaymentContext } from "@/server/payments";

type Props = { searchParams: Promise<{ member?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payments");
  return { title: t("receiveTitle") };
}

export default async function ReceivePaymentPage({ searchParams }: Props) {
  const me = await requirePageUser("/manage/payments/new");
  if (!can(me.role, "payments.record")) redirect("/manage");

  const { member } = await searchParams;
  const memberId = typeof member === "string" ? member : null;
  const t = await getTranslations("payments");

  if (!memberId) {
    const members = await listMembers();
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader
          title={t("receiveTitle")}
          subtitle={t("pickMember")}
          back={{ href: "/manage/payments", label: t("title") }}
        />
        <MemberPicker members={members} />
      </div>
    );
  }

  const context = await getPaymentContext(memberId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={t("receiveTitle")} back={{ href: "/manage/payments", label: t("title") }} />
      {/* A fresh form per member so the amount starts from their own dues. */}
      <PaymentForm key={context.member.id} context={context} today={todayKey()} />
    </div>
  );
}
