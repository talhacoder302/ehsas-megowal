"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateApprovalSettingsAction } from "@/app/manage/settings/approvals/actions";
import type { ServerErrorCode } from "@/lib/errors";
import { approvalSettingsSchema, type ApprovalSettingsInput } from "@/lib/validators";

type ApprovalValues = { enabled: boolean; limit: number };

/** Admin: second-head approval for large disbursements. */
export function ApprovalSettingsForm({ enabled, limit }: ApprovalValues) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<ApprovalSettingsInput, unknown, ApprovalValues>({
    resolver: zodResolver(approvalSettingsSchema),
    defaultValues: { enabled, limit: String(limit) },
  });
  const on = useWatch({ control: form.control, name: "enabled" });

  async function onSubmit(values: ApprovalValues) {
    setServerError(null);
    const result = await updateApprovalSettingsAction(values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("settings.approvals.saved"));
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FieldGroup>
            <FormError code={serverError} />
            <Controller
              name="enabled"
              control={form.control}
              render={({ field }) => (
                <label htmlFor="approval-enabled" className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{t("settings.approvals.enabled")}</span>
                    <span className="text-xs text-muted-foreground">{t("settings.approvals.enabledHint")}</span>
                  </span>
                  <Switch id="approval-enabled" checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <Controller
              name="limit"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} data-disabled={!on}>
                  <FieldLabel htmlFor="approval-limit">{t("settings.approvals.limit")}</FieldLabel>
                  <Input
                    {...field}
                    value={String(field.value)}
                    id="approval-limit"
                    inputMode="numeric"
                    dir="ltr"
                    disabled={!on}
                    autoComplete="off"
                    className="h-10"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error ? (
                    <FieldError>{validation(fieldState.error.message)}</FieldError>
                  ) : (
                    <FieldDescription>{t("settings.approvals.limitHint")}</FieldDescription>
                  )}
                </Field>
              )}
            />
          </FieldGroup>
          <Button type="submit" size="lg" className="self-start" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
