"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveSetupDatesAction } from "@/app/manage/setup/actions";
import type { DateKey, MonthKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { setupDatesSchema, type SetupDatesInput, type SetupDatesValues } from "@/lib/validators";
import { callAction } from "@/lib/offline";

type DatesStepProps = { programStartDate: DateKey | null; firstMonth: MonthKey | null; locked: boolean; today: DateKey; thisMonth: MonthKey };

/** Step 1: when the fund started on paper, and the first month kept in the app. */
export function DatesStep({ programStartDate, firstMonth, locked, today, thisMonth }: DatesStepProps) {
  const t = useTranslations("setup.dates");
  const validation = useValidationMessage();
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<SetupDatesInput, unknown, SetupDatesValues>({
    resolver: zodResolver(setupDatesSchema),
    defaultValues: { programStartDate: programStartDate ?? "", firstMonth: firstMonth ?? thisMonth },
  });

  async function onSubmit(values: SetupDatesValues) {
    setServerError(null);
    const result = await callAction(() => saveSetupDatesAction(values));
    if (!result.ok) return setServerError(result.error);
    toast.success(t("saved"));
    router.push("/manage/setup?step=2");
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <fieldset disabled={locked} className="contents">
            <FieldGroup>
              <FormError code={serverError} />
              <Controller
                name="programStartDate"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="setup-start">{t("programStart")}</FieldLabel>
                    <Input {...field} id="setup-start" type="date" dir="ltr" max={today} className="h-10" aria-invalid={fieldState.invalid} />
                    {fieldState.error ? (
                      <FieldError>{validation(fieldState.error.message)}</FieldError>
                    ) : (
                      <FieldDescription>{t("programStartHint")}</FieldDescription>
                    )}
                  </Field>
                )}
              />
              <Controller
                name="firstMonth"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="setup-first-month">{t("firstMonth")}</FieldLabel>
                    <Input {...field} id="setup-first-month" type="month" dir="ltr" max={thisMonth} placeholder="2026-01" className="h-10" aria-invalid={fieldState.invalid} />
                    {fieldState.error ? (
                      <FieldError>{validation(fieldState.error.message)}</FieldError>
                    ) : (
                      <FieldDescription>{t("firstMonthHint")}</FieldDescription>
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
            <Button type="submit" size="lg" className="self-start" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              {t("save")}
            </Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
