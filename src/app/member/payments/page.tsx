import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MemberLedgerView } from "@/components/shared/member-ledger";
import { getMemberLedger } from "@/server/ledger";
import { requireMyMemberId } from "@/server/member-portal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("memberPayments");
  return { title: t("title") };
}

export default async function MemberPaymentsPage() {
  const memberId = await requireMyMemberId();
  const [t, ledger] = await Promise.all([getTranslations("memberPayments"), getMemberLedger(memberId)]);
  if (!ledger) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <MemberLedgerView ledger={ledger} memberId={memberId} memberArea />
    </div>
  );
}
