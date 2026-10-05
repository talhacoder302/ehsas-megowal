"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CoinsIcon, InfoIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addRateAction } from "@/app/manage/settings/rates/actions";
import { formatDate, formatMonth, shiftMonth, type MonthKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { rateFormSchema, type RateFormInput, type RateFormValues } from "@/lib/validators";
import type { RateItem } from "@/server/rates";

export function RatesView({ rates, currentMonth }: { rates: RateItem[]; currentMonth: MonthKey }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);

  const form = useForm<RateFormInput, unknown, RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    // New rates usually start from next month.
    defaultValues: { amount: "", effectiveFrom: shiftMonth(currentMonth, 1), note: "" },
  });

  async function onSubmit(values: RateFormValues) {
    setServerError(null);
    const result = await addRateAction(values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("settings.rates.added"));
    form.reset({ amount: "", effectiveFrom: shiftMonth(currentMonth, 1), note: "" });
  }

  const submitting = form.formState.isSubmitting;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.rates.addTitle")}</CardTitle>
          <CardDescription>{t("settings.rates.addHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
            <FieldGroup>
              <FormError code={serverError} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  name="amount"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="rate-amount">{t("settings.rates.amount")}</FieldLabel>
                      <Input
                        {...field}
                        value={String(field.value)}
                        id="rate-amount"
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="500"
                        autoComplete="off"
                        className="h-10"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError>{validation(fieldState.error?.message)}</FieldError>
                    </Field>
                  )}
                />
                <Controller
                  name="effectiveFrom"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="rate-from">{t("settings.rates.effectiveFrom")}</FieldLabel>
                      <Input
                        {...field}
                        id="rate-from"
                        type="month"
                        dir="ltr"
                        placeholder="YYYY-MM"
                        className="h-10"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.error ? (
                        <FieldError>{validation(fieldState.error.message)}</FieldError>
                      ) : (
                        <FieldDescription>{t("settings.rates.effectiveFromHint")}</FieldDescription>
                      )}
                    </Field>
                  )}
                />
              </div>
              <Controller
                name="note"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="rate-note">{t("settings.rates.note")}</FieldLabel>
                    <Input
                      {...field}
                      id="rate-note"
                      placeholder={t("settings.rates.notePlaceholder")}
                      autoComplete="off"
                      className="h-10"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError>{validation(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </FieldGroup>
            <Button type="submit" size="lg" className="self-start" disabled={submitting}>
              {submitting ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              {t("settings.rates.add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Alert>
        <InfoIcon />
        <AlertDescription>{t("settings.rates.billsKeepAmount")}</AlertDescription>
      </Alert>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("settings.rates.history")}</h2>
        {rates.length === 0 ? (
          <EmptyState icon={CoinsIcon} title={t("settings.rates.emptyTitle")} description={t("settings.rates.emptyBody")} />
        ) : (
          <ol className="flex flex-col gap-2">
            {rates.map((rate) => {
              const upcoming = rate.effectiveFrom > currentMonth;
              return (
                <li
                  key={rate.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 ${
                    rate.isCurrent ? "border-primary/50 ring-1 ring-primary/20" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold">{formatRupees(rate.amount, locale)}</span>
                      {rate.isCurrent ? <Badge>{t("settings.rates.current")}</Badge> : null}
                      {upcoming ? <Badge variant="outline">{t("settings.rates.upcoming")}</Badge> : null}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {t("settings.rates.from", { month: formatMonth(rate.effectiveFrom, locale) })}
                    </span>
                    {rate.note ? <span className="text-sm">{rate.note}</span> : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {rate.createdByName
                      ? t("settings.rates.addedBy", { name: rate.createdByName, date: formatDate(rate.createdAt, locale) })
                      : formatDate(rate.createdAt, locale)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
