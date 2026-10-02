"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult, ServerErrorCode } from "@/lib/errors";

type ConfirmDialogProps<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<T>>;
  onDone: (data: T) => void;
};

/** "Are you sure?" dialog that runs a server action and shows its error. */
export function ConfirmDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onDone,
}: ConfirmDialogProps<T>) {
  const t = useTranslations("common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ServerErrorCode | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await onConfirm();
    setPending(false);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
    onDone(result.data);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FormError code={error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="lg" disabled={pending}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="lg"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={confirm}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
