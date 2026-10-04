"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, CopyIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TempPasswordResult } from "@/app/manage/users/actions";
import { formatMobile } from "@/lib/validators";

/** Shows a new temporary password once, with copy and WhatsApp share. */
export function TempPasswordDialog({ result, onClose }: { result: TempPasswordResult | null; onClose: () => void }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(`${formatMobile(result.user.mobile)}\n${result.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={result !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.tempTitle")}</DialogTitle>
          <DialogDescription>{t("users.tempBody", { name: result?.user.name ?? "" })}</DialogDescription>
        </DialogHeader>

        {result ? (
          <dl className="grid gap-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{t("users.tempMobile")}</dt>
              <dd dir="ltr" className="font-mono text-base">{formatMobile(result.user.mobile)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{t("users.tempPassword")}</dt>
              <dd dir="ltr" lang="en" className="font-mono text-xl font-semibold tracking-wider select-all">
                {result.tempPassword}
              </dd>
            </div>
          </dl>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
            {result ? (
              <Button asChild variant="outline" size="lg">
                <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon />
                  {t("users.shareWhatsApp")}
                </a>
              </Button>
            ) : null}
          </div>
          <Button type="button" size="lg" onClick={onClose}>
            {t("common.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
