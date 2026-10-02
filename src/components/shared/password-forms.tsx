"use client";

import { useState } from "react";
import { Controller, useForm, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { changePasswordAction, setPasswordAction } from "@/app/(auth)/actions";
import type { ServerErrorCode } from "@/lib/errors";
import {
  changePasswordSchema,
  setPasswordSchema,
  type ChangePasswordInput,
  type SetPasswordInput,
} from "@/lib/validators";

type PasswordFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  autoComplete: "current-password" | "new-password";
  description?: string;
};

function PasswordField<T extends FieldValues>({ control, name, label, autoComplete, description }: PasswordFieldProps<T>) {
  const validation = useValidationMessage();
  const id = `password-${name}`;
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <PasswordInput {...field} id={id} autoComplete={autoComplete} aria-invalid={fieldState.invalid} />
          {fieldState.error ? (
            <FieldError>{validation(fieldState.error.message)}</FieldError>
          ) : description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
        </Field>
      )}
    />
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  const t = useTranslations("common");
  return (
    <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      {pending ? t("saving") : label}
    </Button>
  );
}

/** Forced change after logging in with a temporary password. Redirects home on success. */
export function SetPasswordForm() {
  const t = useTranslations("account");
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: SetPasswordInput) {
    setServerError(null);
    const result = await setPasswordAction(values);
    if (!result.ok) setServerError(result.error);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError code={serverError} />
        <PasswordField
          control={form.control}
          name="newPassword"
          label={t("newPassword")}
          autoComplete="new-password"
          description={t("changePasswordSubtitle")}
        />
        <PasswordField control={form.control} name="confirmPassword" label={t("confirmPassword")} autoComplete="new-password" />
        <SubmitButton pending={form.formState.isSubmitting} label={t("forcedSubmit")} />
      </FieldGroup>
    </form>
  );
}

/** Profile: change own password, current password required. */
export function ChangePasswordForm() {
  const t = useTranslations("account");
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setServerError(null);
    const result = await changePasswordAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    form.reset();
    toast.success(t("passwordChanged"));
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError code={serverError} />
        <PasswordField control={form.control} name="currentPassword" label={t("currentPassword")} autoComplete="current-password" />
        <PasswordField control={form.control} name="newPassword" label={t("newPassword")} autoComplete="new-password" />
        <PasswordField control={form.control} name="confirmPassword" label={t("confirmPassword")} autoComplete="new-password" />
        <SubmitButton pending={form.formState.isSubmitting} label={t("savePassword")} />
      </FieldGroup>
    </form>
  );
}
