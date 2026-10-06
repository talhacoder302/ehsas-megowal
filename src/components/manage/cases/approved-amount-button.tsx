"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Loader2Icon, PencilLineIcon } from "lucide-react";
import { toast } from "sonner";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { changeApprovedAmountAction } from "@/app/manage/cases/actions";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import {
  approvedAmountChangeSchema,
  type ApprovedAmountChangeInput,
  type ApprovedAmountChangeValues,
} from "@/lib/validators";

type ApprovedAmountButtonProps = {
  caseId: string;
  approvedAmount: number;
  /** Paid plus pending: the amount cannot go below this. */
  committed: number;
};

/** Raise or lower a case's approved amount, with a reason (shown on the timeline). */
export function ApprovedAmountButton(props: ApprovedAmountButtonProps) {
  const t = useTranslations("disbursements");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLineIcon />
        {t("changeApproved")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">{open ? <AmountForm {...props} onDone={() => setOpen(false)} /> : null}</DialogContent>
      </Dialog>
    </>
  );
}

function AmountForm({ caseId, approvedAmount, committed, onDone }: ApprovedAmountButtonProps & { onDone: () => void }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<ApprovedAmountChangeInput, unknown, ApprovedAmountChangeValues>({
    resolver: zodResolver(approvedAmountChangeSchema),
    defaultValues: { approvedAmount: String(approvedAmount), reason: "" },
  });

  async function onSubmit(values: ApprovedAmountChangeValues) {
    setServerError(null);
    const result = await changeApprovedAmountAction(caseId, values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("disbursements.approvedChanged"));
    onDone();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("disbursements.changeApproved")}</DialogTitle>
        <DialogDescription>{t("disbursements.changeApprovedBody", { amount: formatRupees(approvedAmount, locale) })}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <FormError code={serverError} />
        <Controller
          name="approvedAmount"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-approved">{t("cases.status.approvedAmount")}</FieldLabel>
              <Input
                {...field}
                value={String(field.value)}
                id="new-approved"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                className="h-10"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("disbursements.notBelow", { amount: formatRupees(committed, locale) })}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-approved-reason">{t("cases.status.reason")}</FieldLabel>
              <Textarea {...field} id="new-approved-reason" rows={2} placeholder={t("disbursements.changeReasonPlaceholder")} aria-invalid={fieldState.invalid} />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="lg">
            {t("common.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
