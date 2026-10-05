"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult, ServerErrorCode } from "@/lib/errors";
import { reasonFormSchema, type ReasonFormInput } from "@/lib/validators";

type ReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  placeholder?: string;
  destructive?: boolean;
  onConfirm: (input: { reason: string }) => Promise<ActionResult<unknown>>;
  onDone: () => void;
};

/** "Are you sure?" dialog that needs a written reason (cancel a payment, waive a bill). */
export function ReasonDialog(props: ReasonDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.open ? <ReasonForm {...props} /> : null}</DialogContent>
    </Dialog>
  );
}

function ReasonForm({ title, description, confirmLabel, placeholder, destructive, onConfirm, onDone, onOpenChange }: ReasonDialogProps) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<ReasonFormInput>({ resolver: zodResolver(reasonFormSchema), defaultValues: { reason: "" } });

  async function onSubmit(values: ReasonFormInput) {
    setServerError(null);
    const result = await onConfirm(values);
    if (!result.ok) return setServerError(result.error);
    onOpenChange(false);
    onDone();
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <FormError code={serverError} />
      <Controller
        name="reason"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="reason-text">{t("members.status.reason")}</FieldLabel>
            <Textarea {...field} id="reason-text" rows={3} placeholder={placeholder} aria-invalid={fieldState.invalid} />
            <FieldError>{validation(fieldState.error?.message)}</FieldError>
          </Field>
        )}
      />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="lg" disabled={submitting}>
            {t("common.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" variant={destructive ? "destructive" : "default"} disabled={submitting}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
