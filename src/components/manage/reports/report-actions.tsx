"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileDownIcon, MailIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { emailReportAction } from "@/app/manage/reports/actions";
import { formatMonth, type MonthKey } from "@/lib/dates";
import type { ReportVersion } from "@/lib/reports";

type ReportActionsProps = {
  month: MonthKey;
  version: ReportVersion;
  /** wa.me link with the Roman Urdu summary and the report link. */
  whatsappUrl: string;
  /** null when email is not set up (then the button is not shown). */
  emailRecipients: number | null;
};

/** PDF downloads of the version on screen, WhatsApp share and (optional) email. */
export function ReportActions({ month, version, whatsappUrl, emailRecipients }: ReportActionsProps) {
  const t = useTranslations("reports");
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [emailing, setEmailing] = useState(false);
  const pdf = (lang: "en" | "ur") => `/api/reports/${month}/pdf?version=${version}&lang=${lang}`;
  const monthName = formatMonth(month, locale);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Button asChild size="lg" className="h-11 bg-[#1f8f4e] text-white hover:bg-[#1a7a43]">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircleIcon />
            {t("shareWhatsApp")}
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={pdf("en")} target="_blank" rel="noopener noreferrer">
            <FileDownIcon />
            {`PDF · ${t("pdfEnglish")}`}
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={pdf("ur")} target="_blank" rel="noopener noreferrer">
            <FileDownIcon />
            PDF · <span lang="ur">{t("pdfUrdu")}</span>
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("shareHint")}</p>

      {emailRecipients === null ? (
        <p className="text-xs text-muted-foreground">{t("emailOff")}</p>
      ) : emailRecipients === 0 ? (
        <p className="text-xs text-muted-foreground">{t("emailNone")}</p>
      ) : (
        <Button variant="outline" size="lg" className="self-start" onClick={() => setEmailing(true)}>
          <MailIcon />
          {t("emailButton")}
        </Button>
      )}

      <ConfirmDialog
        open={emailing}
        onOpenChange={setEmailing}
        title={t("emailTitle", { month: monthName })}
        description={t("emailBody", { count: emailRecipients ?? 0 })}
        confirmLabel={t("emailConfirm")}
        onConfirm={() => emailReportAction(month)}
        onDone={(result) =>
          result.failed > 0
            ? toast.error(t("emailFailed", { sent: result.sent, failed: result.failed }))
            : toast.success(t("emailSent", { count: result.sent }))
        }
      />
    </div>
  );
}
