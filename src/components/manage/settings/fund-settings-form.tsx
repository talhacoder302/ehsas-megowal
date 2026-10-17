"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateFundSettingsAction } from "@/app/manage/settings/fund/actions";
import type { ServerErrorCode } from "@/lib/errors";
import { fundSettingsSchema, type FundSettingsInput, type FundSettingsValues } from "@/lib/validators";
import { callAction } from "@/lib/offline";

function SwitchRow({ id, title, hint, checked, onChange }: { id: string; title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** Admin: emergency reserve, second-head approval and the beneficiary name default. */
export function FundSettingsForm(props: FundSettingsValues) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<FundSettingsInput, unknown, FundSettingsValues>({
    resolver: zodResolver(fundSettingsSchema),
    defaultValues: {
      emergencyReserve: String(props.emergencyReserve),
      approvalEnabled: props.approvalEnabled,
      approvalLimit: String(props.approvalLimit),
      showBeneficiaryNamesDefault: props.showBeneficiaryNamesDefault,
    },
  });
  const approvalOn = useWatch({ control: form.control, name: "approvalEnabled" });

  async function onSubmit(values: FundSettingsValues) {
    setServerError(null);
    const result = await callAction(() => updateFundSettingsAction(values));
    if (!result.ok) return setServerError(result.error);
    toast.success(t("settings.fund.saved"));
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormError code={serverError} />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.fund.reserveTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            name="emergencyReserve"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="fund-reserve">{t("settings.fund.reserve")}</FieldLabel>
                <Input
                  {...field}
                  value={String(field.value)}
                  id="fund-reserve"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error ? (
                  <FieldError>{validation(fieldState.error.message)}</FieldError>
                ) : (
                  <FieldDescription>{t("settings.fund.reserveHint")}</FieldDescription>
                )}
              </Field>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.fund.approvalTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Controller
              name="approvalEnabled"
              control={form.control}
              render={({ field }) => (
                <SwitchRow
                  id="fund-approval"
                  title={t("settings.fund.enabled")}
                  hint={t("settings.fund.enabledHint")}
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="approvalLimit"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} data-disabled={!approvalOn}>
                  <FieldLabel htmlFor="fund-limit">{t("settings.fund.limit")}</FieldLabel>
                  <Input
                    {...field}
                    value={String(field.value)}
                    id="fund-limit"
                    inputMode="numeric"
                    dir="ltr"
                    disabled={!approvalOn}
                    autoComplete="off"
                    className="h-10"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error ? (
                    <FieldError>{validation(fieldState.error.message)}</FieldError>
                  ) : (
                    <FieldDescription>{t("settings.fund.limitHint")}</FieldDescription>
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.fund.privacyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            name="showBeneficiaryNamesDefault"
            control={form.control}
            render={({ field }) => (
              <SwitchRow
                id="fund-names"
                title={t("settings.fund.namesDefault")}
                hint={t("settings.fund.namesDefaultHint")}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="self-start" disabled={submitting}>
        {submitting ? <Loader2Icon className="animate-spin" /> : null}
        {t("common.save")}
      </Button>
    </form>
  );
}
