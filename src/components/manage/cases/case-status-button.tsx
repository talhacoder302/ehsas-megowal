"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { EyeIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { changeCaseStatusAction } from "@/app/manage/cases/actions";
import type { CaseStatus } from "@/lib/cases";
import type { ServerErrorCode } from "@/lib/errors";
import { caseStatusChangeSchema, type CaseStatusChangeInput, type CaseStatusChangeValues } from "@/lib/validators";

type CaseStatusButtonProps = {
  caseId: string;
  caseNo: string;
  status: CaseStatus;
  nextStatuses: CaseStatus[];
  estimatedAmount: number;
  /** Status picked when the dialog opens (must be one of nextStatuses). */
  defaultStatus?: CaseStatus;
  /** Button text instead of "Change status". */
  label?: string;
};

export function CaseStatusButton(props: CaseStatusButtonProps) {
  const t = useTranslations("cases.status");
  const [open, setOpen] = useState(false);
  if (props.nextStatuses.length === 0) return null;

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <RefreshCwIcon />
        {props.label ?? t("change")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          {open ? <StatusForm {...props} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusForm({
  caseId,
  caseNo,
  status,
  nextStatuses,
  estimatedAmount,
  defaultStatus,
  onDone,
}: CaseStatusButtonProps & { onDone: () => void }) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<CaseStatusChangeInput, unknown, CaseStatusChangeValues>({
    resolver: zodResolver(caseStatusChangeSchema),
    defaultValues: {
      status: defaultStatus && nextStatuses.includes(defaultStatus) ? defaultStatus : nextStatuses[0],
      reason: "",
      approvedAmount: String(estimatedAmount),
    },
  });
  const chosen = useWatch({ control: form.control, name: "status" });

  async function onSubmit(values: CaseStatusChangeValues) {
    setServerError(null);
    const result = await changeCaseStatusAction(caseId, values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("cases.status.changed", { status: t(`caseStatus.${values.status}`) }));
    onDone();
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("cases.status.title", { caseNo })}</DialogTitle>
        <DialogDescription>{t("cases.status.current", { status: t(`caseStatus.${status}`) })}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <FormError code={serverError} />
        <Controller
          name="status"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="case-next-status">{t("cases.status.newStatus")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="case-next-status" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`caseStatus.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        {chosen === "approved" ? (
          <Controller
            name="approvedAmount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="case-approved-amount">{t("cases.status.approvedAmount")}</FieldLabel>
                <Input
                  {...field}
                  value={String(field.value)}
                  id="case-approved-amount"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error ? (
                  <FieldError>{validation(fieldState.error.message)}</FieldError>
                ) : (
                  <FieldDescription>{t("cases.status.approvedAmountHint")}</FieldDescription>
                )}
              </Field>
            )}
          />
        ) : null}

        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="case-status-reason">{t("cases.status.reason")}</FieldLabel>
              <Textarea {...field} id="case-status-reason" rows={3} placeholder={t("cases.status.reasonPlaceholder")} aria-invalid={fieldState.invalid} />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <Alert>
          <EyeIcon />
          <AlertDescription>{t("cases.status.membersSeeReason")}</AlertDescription>
        </Alert>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="lg">
            {t("common.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" variant={chosen === "rejected" ? "destructive" : "default"} disabled={submitting}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {t("cases.status.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
