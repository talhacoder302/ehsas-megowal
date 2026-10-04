"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createMemberAction, updateMemberAction } from "@/app/manage/members/actions";
import { todayKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { memberFormSchema, type MemberFormInput, type MemberFormValues } from "@/lib/validators";

type MemberFormProps = {
  /** Leave out to add a new member. */
  member?: { id: string; values: MemberFormInput };
  /** Mohallas already in use, offered as suggestions. */
  mohallas: string[];
};

export function MemberForm({ member, mohallas }: MemberFormProps) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);

  const form = useForm<MemberFormInput, unknown, MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: member?.values ?? {
      name: "",
      fatherName: "",
      mobile: "",
      mohalla: "",
      address: "",
      joinDate: todayKey(),
      notes: "",
    },
  });

  async function onSubmit(values: MemberFormValues) {
    setServerError(null);
    if (member) {
      const result = await updateMemberAction(member.id, values);
      if (!result.ok) return setServerError(result.error);
      toast.success(t("members.updated"));
      router.push(`/manage/members/${member.id}`);
    } else {
      const result = await createMemberAction(values);
      if (!result.ok) return setServerError(result.error);
      toast.success(t("members.created", { memberNo: result.data.memberNo }));
      router.push(`/manage/members/${result.data.id}`);
    }
  }

  const submitting = form.formState.isSubmitting;
  const cancelHref = member ? `/manage/members/${member.id}` : "/manage/members";

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormError code={serverError} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="member-name">{t("members.form.name")}</FieldLabel>
                <Input {...field} id="member-name" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
          <Controller
            name="fatherName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="member-father">{t("members.form.fatherName")}</FieldLabel>
                <Input {...field} id="member-father" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="mobile"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="member-mobile">{t("members.form.mobile")}</FieldLabel>
                <Input
                  {...field}
                  id="member-mobile"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="03XX-XXXXXXX"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error ? (
                  <FieldError>{validation(fieldState.error.message)}</FieldError>
                ) : (
                  <FieldDescription>{t("members.form.mobileHint")}</FieldDescription>
                )}
              </Field>
            )}
          />
          <Controller
            name="joinDate"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="member-join">{t("members.form.joinDate")}</FieldLabel>
                <Input
                  {...field}
                  id="member-join"
                  type="date"
                  dir="ltr"
                  max={todayKey()}
                  className="h-10"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error ? (
                  <FieldError>{validation(fieldState.error.message)}</FieldError>
                ) : (
                  <FieldDescription>{t("members.form.joinDateHint")}</FieldDescription>
                )}
              </Field>
            )}
          />
        </div>

        <Controller
          name="mohalla"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="member-mohalla">{t("members.form.mohalla")}</FieldLabel>
              <Input
                {...field}
                id="member-mohalla"
                list="member-mohalla-options"
                autoComplete="off"
                className="h-10"
                aria-invalid={fieldState.invalid}
              />
              <datalist id="member-mohalla-options">
                {mohallas.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("members.form.mohallaHint")}</FieldDescription>
              )}
            </Field>
          )}
        />

        <Controller
          name="address"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="member-address">{t("members.form.address")}</FieldLabel>
              <Input {...field} id="member-address" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="notes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="member-notes">{t("members.form.notes")}</FieldLabel>
              <Textarea {...field} id="member-notes" rows={3} aria-invalid={fieldState.invalid} />
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("members.form.notesHint")}</FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild type="button" variant="outline" size="lg">
          <Link href={cancelHref}>{t("common.cancel")}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {member ? t("common.save") : t("members.form.create")}
        </Button>
      </div>
    </form>
  );
}
