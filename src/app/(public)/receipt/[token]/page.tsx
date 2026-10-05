import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FileDownIcon } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ReceiptCard } from "@/components/shared/receipt-card";
import { Button } from "@/components/ui/button";
import { getReceiptByToken } from "@/server/payments";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const receipt = await getReceiptByToken(token);
  const t = await getTranslations("receipt");
  return {
    title: receipt ? `${t("title")} ${receipt.receiptNumber}` : t("title"),
    // Receipts are private to whoever has the link.
    robots: { index: false, follow: false },
  };
}

/** Public receipt page: the link shared with the member on WhatsApp. No login needed. */
export default async function PublicReceiptPage({ params }: Props) {
  const { token } = await params;
  const [t, receipt] = await Promise.all([getTranslations("receipt"), getReceiptByToken(token)]);
  if (!receipt) notFound();

  const pdf = `/receipt/${token}/pdf`;
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="mx-auto flex h-16 w-full max-w-xl items-center justify-between gap-2 px-4">
        <Brand />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-10">
        <ReceiptCard receipt={receipt} />
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="lg">
            <a href={`${pdf}?lang=en`} target="_blank" rel="noopener noreferrer">
              <FileDownIcon />
              {t("pdfEnglish")}
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={`${pdf}?lang=ur`} target="_blank" rel="noopener noreferrer">
              <FileDownIcon />
              <span lang="ur">{t("pdfUrdu")}</span>
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
