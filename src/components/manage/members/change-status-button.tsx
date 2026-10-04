"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { InfoIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
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
import { changeMemberStatusAction } from "@/app/manage/members/actions";
import { todayKey, type DateKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/member-status";
import {
  memberStatusChangeSchema,
  type MemberStatusChangeInput,
  type MemberStatusChangeValues,
} from "@/lib/validators";

type ChangeStatusButtonProps = {
  memberId: string;
  name: string;
  status: MemberStatus;
  /** The earliest allowed date: the join date or the last status change, whichever is later. */
  minDate: DateKey;
};

export function ChangeStatusButton(props: ChangeStatusButtonProps) {
  const t = useTranslations("members.status");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        <RefreshCwIcon />
        {t("change")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          {open ? <StatusForm {...props} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusForm({ memberId, name, status, minDate, onDone }: ChangeStatusButtonProps & { onDone: () => void }) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const today = todayKey();

  const form = useForm<MemberStatusChangeInput, unknown, MemberStatusChangeValues>({
    resolver: zodResolver(memberStatusChangeSchema),
    defaultValues: {
      status: status === "active" ? "left" : "active",
      date: today < minDate ? minDate : today,
      reason: "",
    },
  });
  const chosen = useWatch({ control: form.control, name: "status" });

  async function onSubmit(values: MemberStatusChangeValues) {
    setServerError(null);
    const result = await changeMemberStatusAction(memberId, values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("members.status.changed"));
    onDone();
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("members.status.change")}</DialogTitle>
        <DialogDescription>
          {t("members.status.subtitle", { name, status: t(`memberStatus.${status}`) })}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <FormError code={serverError} />

        <Controller
          name="status"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="status-new">{t("members.status.newStatus")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status-new" className="h-10 w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUSES.filter((s) => s !== status).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`memberStatus.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="date"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="status-date">{t("members.status.date")}</FieldLabel>
              <Input
                {...field}
                id="status-date"
                type="date"
                dir="ltr"
                min={minDate}
                max={today}
                className="h-10"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("members.status.dateHint")}</FieldDescription>
              )}
            </Field>
          )}
        />

        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="status-reason">{t("members.status.reason")}</FieldLabel>
              <Textarea
                {...field}
                id="status-reason"
                rows={2}
                placeholder={t("members.status.reasonPlaceholder")}
                aria-invalid={fieldState.invalid}
              />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        {chosen !== "active" ? (
          <Alert>
            <InfoIcon />
            <AlertDescription>
              {t("members.status.billingNote")}
              {chosen === "deceased" ? ` ${t("members.status.deceasedNote")}` : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="lg">
            {t("common.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {t("members.status.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
