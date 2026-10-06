"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Loader2Icon, NotebookPenIcon } from "lucide-react";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { addCaseNoteAction } from "@/app/manage/cases/actions";
import { formatDateTime } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { caseNoteSchema, type CaseNoteInput } from "@/lib/validators";
import type { CaseNoteItem } from "@/server/cases";

/** Private notes for the heads (never shown to members). */
export function CaseNotes({ caseId, notes, canAdd }: { caseId: string; notes: CaseNoteItem[]; canAdd: boolean }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<CaseNoteInput>({ resolver: zodResolver(caseNoteSchema), defaultValues: { text: "" } });

  async function onSubmit(values: CaseNoteInput) {
    setServerError(null);
    const result = await addCaseNoteAction(caseId, values);
    if (!result.ok) return setServerError(result.error);
    form.reset({ text: "" });
  }

  return (
    <div className="flex flex-col gap-3">
      {canAdd ? (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2">
          <FormError code={serverError} />
          <Controller
            name="text"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Textarea
                  {...field}
                  rows={2}
                  placeholder={t("cases.notes.placeholder")}
                  aria-label={t("cases.notes.add")}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
          <Button type="submit" variant="outline" className="self-start" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : <NotebookPenIcon />}
            {t("cases.notes.add")}
          </Button>
        </form>
      ) : null}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("cases.notes.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="whitespace-pre-line">{n.text}</p>
              <span className="mt-1 block text-xs text-muted-foreground">
                {n.createdByName ? `${n.createdByName} · ` : ""}
                {formatDateTime(n.createdAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
