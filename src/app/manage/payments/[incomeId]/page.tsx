import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CircleCheckIcon, UserIcon } from "lucide-react";
import { PageHeader } from "@/components/manage/page-header";
import { ReceiptActions } from "@/components/manage/payments/receipt-actions";
import { ReceiptCard } from "@/components/shared/receipt-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getServerEnv } from "@/lib/env";
import { can } from "@/lib/permissions";
import { receiptMessage, whatsappLink } from "@/lib/whatsapp";
import { requirePageUser } from "@/server/auth/guards";
import { getReceipt } from "@/server/payments";

type Props = {
  params: Promise<{ incomeId: string }>;
  searchParams: Promise<{ new?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { incomeId } = await params;
  const receipt = await getReceipt(incomeId).catch(() => null);
  const t = await getTranslations("receipt");
  return { title: receipt ? `${t("title")} ${receipt.receiptNumber}` : t("title") };
}

export default async function ReceiptPage({ params, searchParams }: Props) {
  const [{ incomeId }, query] = await Promise.all([params, searchParams]);
  const me = await requirePageUser(`/manage/payments/${incomeId}`);
  if (!can(me.role, "payments.record")) redirect("/manage");

  const [t, receipt] = await Promise.all([getTranslations(), getReceipt(incomeId)]);
  if (!receipt) notFound();

  const receiptPath = `/receipt/${receipt.publicToken}`;
  const receiptUrl = `${getServerEnv().NEXT_PUBLIC_APP_URL}${receiptPath}`;
  const whatsappUrl = receipt.memberMobile
    ? whatsappLink(
        receipt.memberMobile,
        receiptMessage({
          name: receipt.member.name,
          programName: receipt.programName,
          villageName: receipt.villageName,
          receiptNumber: receipt.receiptNumber,
          amount: receipt.amount,
          months: receipt.monthsCovered,
          openingDuePaid: receipt.openingDuePaid,
          receiptUrl,
        }),
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader
        title={`${t("receipt.title")} ${receipt.receiptNumber}`}
        subtitle={receipt.accountName ? t("receipt.intoAccount", { account: receipt.accountName }) : undefined}
        back={{ href: "/manage/payments", label: t("payments.title") }}
      />

      {query.new === "1" && !receipt.cancelled ? (
        <Alert className="border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200">
          <CircleCheckIcon />
          <AlertDescription>{t("receipt.savedNotice")}</AlertDescription>
        </Alert>
      ) : null}

      <ReceiptCard receipt={receipt} />

      <ReceiptActions
        incomeId={receipt.id}
        receiptNumber={receipt.receiptNumber}
        receiptUrl={receiptUrl}
        pdfPath={`${receiptPath}/pdf`}
        whatsappUrl={whatsappUrl}
        cancelled={receipt.cancelled}
        canCancel={receipt.canCancel}
      />

      {receipt.member.id ? (
        <Button asChild variant="ghost" className="self-start">
          <Link href={`/manage/members/${receipt.member.id}?tab=contributions`}>
            <UserIcon />
            {t("receipt.openMember")}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
