"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, HourglassIcon, ImageIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { CaseCategoryLabel } from "@/components/shared/case-badges";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { Button } from "@/components/ui/button";
import { approveDisbursementAction, rejectDisbursementAction } from "@/app/manage/cases/actions";
import { formatDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { PendingDisbursementItem } from "@/server/disbursements";

/** Disbursements above the limit waiting for a second head (dashboard). */
export function PendingApprovals({ items }: { items: PendingDisbursementItem[] }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingDisbursementItem | null>(null);

  async function approve(item: PendingDisbursementItem) {
    setBusy(item.id);
    const result = await approveDisbursementAction(item.id);
    setBusy(null);
    if (!result.ok) return toast.error(t(`serverErrors.${result.error}`));
    toast.success(result.data.fullyPaid ? t("disbursements.approvedFullyPaid") : t("disbursements.approvedToast"));
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("dashboard.nothingWaiting")}</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/manage/cases/${d.caseId}`} className="flex min-w-0 flex-col gap-0.5 hover:underline">
                <span className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="font-mono text-xs font-medium">
                    {d.caseNo}
                  </span>
                  <CaseCategoryLabel category={d.category} className="text-xs" />
                </span>
                <span className="font-medium">{d.beneficiaryName}</span>
                <span className="text-xs text-muted-foreground">
                  {t("dashboard.paidTo", { name: d.receivedByName })} · {formatDate(d.date, locale)} · {d.accountName}
                </span>
                <span className="text-xs text-muted-foreground">{t("dashboard.enteredBy", { name: d.paidByName })}</span>
              </Link>
              <span className="shrink-0 text-lg font-semibold">{formatRupees(d.amount, locale)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {d.photoUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={d.photoUrl} target="_blank" rel="noopener noreferrer">
                    <ImageIcon />
                    {t("disbursements.viewPhoto")}
                  </a>
                </Button>
              ) : null}
              {d.canApprove ? (
                <>
                  <Button size="sm" onClick={() => approve(d)} disabled={busy === d.id}>
                    {busy === d.id ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
                    {t("disbursements.approve")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejecting(d)}>
                    <XIcon />
                    {t("disbursements.reject")}
                  </Button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <HourglassIcon className="size-3.5" />
                  {t("disbursements.waitingOther")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ReasonDialog
        open={rejecting !== null}
        onOpenChange={(open) => (open ? null : setRejecting(null))}
        title={t("disbursements.rejectTitle", { amount: formatRupees(rejecting?.amount ?? 0, locale) })}
        description={t("disbursements.rejectBody")}
        confirmLabel={t("disbursements.reject")}
        destructive
        onConfirm={(input) => rejectDisbursementAction(rejecting?.id ?? "", input)}
        onDone={() => toast.success(t("disbursements.rejectedToast"))}
      />
    </>
  );
}
