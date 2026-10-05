"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BanIcon, CheckIcon, CopyIcon, FileDownIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { Button } from "@/components/ui/button";
import { cancelPaymentAction } from "@/app/manage/payments/actions";

type ReceiptActionsProps = {
  incomeId: string;
  receiptNumber: string;
  /** Full public link to the receipt. */
  receiptUrl: string;
  /** Path of the PDF, without the ?lang= part. */
  pdfPath: string;
  /** wa.me link with the Roman Urdu message, or null when the member has no mobile. */
  whatsappUrl: string | null;
  cancelled: boolean;
  canCancel: boolean;
};

export function ReceiptActions(props: ReceiptActionsProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(props.receiptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {props.whatsappUrl && !props.cancelled ? (
          <Button asChild size="lg" className="h-11 bg-[#1f8f4e] text-white hover:bg-[#1a7a43] sm:col-span-2">
            <a href={props.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon />
              {t("receipt.sendWhatsApp")}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="lg">
          <a href={`${props.pdfPath}?lang=en`} target="_blank" rel="noopener noreferrer">
            <FileDownIcon />
            {t("receipt.pdfEnglish")}
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={`${props.pdfPath}?lang=ur`} target="_blank" rel="noopener noreferrer">
            <FileDownIcon />
            <span lang="ur">{t("receipt.pdfUrdu")}</span>
          </a>
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? t("common.copied") : t("receipt.copyLink")}
        </Button>
        {props.canCancel ? (
          <Button type="button" variant="outline" size="lg" className="text-destructive" onClick={() => setCancelling(true)}>
            <BanIcon />
            {t("receipt.cancel")}
          </Button>
        ) : null}
      </div>
      {!props.cancelled && !props.canCancel ? (
        <p className="text-xs text-muted-foreground">{t("receipt.cancelOwnHint")}</p>
      ) : null}
      {!props.whatsappUrl && !props.cancelled ? (
        <p className="text-xs text-muted-foreground">{t("receipt.noMobile")}</p>
      ) : null}

      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t("receipt.cancelTitle", { receipt: props.receiptNumber })}
        description={t("receipt.cancelBody")}
        confirmLabel={t("receipt.cancel")}
        placeholder={t("receipt.cancelPlaceholder")}
        destructive
        onConfirm={(input) => cancelPaymentAction(props.incomeId, input)}
        onDone={() => toast.success(t("receipt.cancelledToast"))}
      />
    </div>
  );
}
