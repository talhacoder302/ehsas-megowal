"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_ICONS } from "@/components/shared/case-badges";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createCaseAction, updateCaseAction } from "@/app/manage/cases/actions";
import { CASE_CATEGORIES } from "@/lib/cases";
import type { ServerErrorCode } from "@/lib/errors";
import { caseFormSchema, type CaseFormInput, type CaseFormValues } from "@/lib/validators";

type CaseFormProps = {
  /** Leave out to open a new case. */
  aidCase?: { id: string; values: CaseFormInput };
  mohallas: string[];
  /** Settings.showBeneficiaryNamesDefault, used for new cases. */
  showNamesDefault: boolean;
};

export function CaseForm({ aidCase, mohallas, showNamesDefault }: CaseFormProps) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);

  const form = useForm<CaseFormInput, unknown, CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: aidCase?.values ?? {
      category: "medical",
      beneficiaryName: "",
      guardianName: "",
      mohalla: "",
      contactMobile: "",
      recommendedBy: "",
      description: "",
      estimatedAmount: "",
      expectedDate: "",
      showNameToMembers: showNamesDefault,
    },
  });

  async function onSubmit(values: CaseFormValues) {
    setServerError(null);
    if (aidCase) {
      const result = await updateCaseAction(aidCase.id, values);
      if (!result.ok) return setServerError(result.error);
      toast.success(t("cases.updated"));
      router.push(`/manage/cases/${aidCase.id}`);
    } else {
      const result = await createCaseAction(values);
      if (!result.ok) return setServerError(result.error);
      toast.success(t("cases.created", { caseNo: result.data.caseNo }));
      router.push(`/manage/cases/${result.data.id}`);
    }
  }

  const submitting = form.formState.isSubmitting;
  const text = (name: "beneficiaryName" | "guardianName" | "recommendedBy", id: string, hint?: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{t(`cases.form.${name}`)}</FieldLabel>
          <Input {...field} id={id} autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
          {fieldState.error ? (
            <FieldError>{validation(fieldState.error.message)}</FieldError>
          ) : hint ? (
            <FieldDescription>{hint}</FieldDescription>
          ) : null}
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormError code={serverError} />

        <Controller
          name="category"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="case-category">{t("cases.form.category")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="case-category" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_CATEGORIES.map((c) => {
                    const Icon = CATEGORY_ICONS[c];
                    return (
                      <SelectItem key={c} value={c}>
                        <Icon className="text-primary" />
                        {t(`caseCategory.${c}`)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          {text("beneficiaryName", "case-beneficiary")}
          {text("guardianName", "case-guardian", t("cases.form.guardianHint"))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="mohalla"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="case-mohalla">{t("cases.form.mohalla")}</FieldLabel>
                <Input {...field} id="case-mohalla" list="case-mohalla-options" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
                <datalist id="case-mohalla-options">
                  {mohallas.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
          <Controller
            name="contactMobile"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="case-contact">{t("cases.form.contactMobile")}</FieldLabel>
                <Input
                  {...field}
                  id="case-contact"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="03XX-XXXXXXX"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
        </div>

        {text("recommendedBy", "case-recommended", t("cases.form.recommendedByHint"))}

        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="case-description">{t("cases.form.description")}</FieldLabel>
              <Textarea {...field} id="case-description" rows={4} placeholder={t("cases.form.descriptionPlaceholder")} aria-invalid={fieldState.invalid} />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="estimatedAmount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="case-estimate">{t("cases.form.estimatedAmount")}</FieldLabel>
                <Input
                  {...field}
                  value={String(field.value)}
                  id="case-estimate"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
          <Controller
            name="expectedDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="case-expected">{t("cases.form.expectedDate")}</FieldLabel>
                <Input {...field} id="case-expected" type="date" dir="ltr" className="h-10" aria-invalid={fieldState.invalid} />
                {fieldState.error ? (
                  <FieldError>{validation(fieldState.error.message)}</FieldError>
                ) : (
                  <FieldDescription>{t("cases.form.expectedDateHint")}</FieldDescription>
                )}
              </Field>
            )}
          />
        </div>

        <Controller
          name="showNameToMembers"
          control={form.control}
          render={({ field }) => (
            <label
              htmlFor="case-show-name"
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-amber-500/50 has-[[data-state=checked]]:bg-amber-500/5"
            >
              <span className="mt-0.5 text-muted-foreground">{field.value ? <EyeIcon className="size-5" /> : <EyeOffIcon className="size-5" />}</span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{t("cases.form.showNameToMembers")}</span>
                <span className="text-xs text-muted-foreground">{t("cases.form.showNameHint")}</span>
              </span>
              <Switch id="case-show-name" checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild type="button" variant="outline" size="lg">
          <Link href={aidCase ? `/manage/cases/${aidCase.id}` : "/manage/cases"}>{t("common.cancel")}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {aidCase ? t("common.save") : t("cases.form.create")}
        </Button>
      </div>
    </form>
  );
}
