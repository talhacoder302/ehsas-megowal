"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/app/(auth)/actions";
import type { ServerErrorCode } from "@/lib/errors";
import { loginSchema, type LoginInput, type LoginValues } from "@/lib/validators";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("login");
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);

  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    // Redirects on success, so only failures come back.
    const result = await loginAction(values, callbackUrl);
    if (!result.ok) {
      setServerError(result.error);
      form.resetField("password");
      form.setFocus("password");
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError code={serverError} />
        <Controller
          name="mobile"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-mobile">{t("mobile")}</FieldLabel>
              <Input
                {...field}
                id="login-mobile"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                dir="ltr"
                placeholder="03XX-XXXXXXX"
                className="h-11 text-base"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("mobileHint")}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">{t("password")}</FieldLabel>
              <PasswordInput
                {...field}
                id="login-password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? <FieldError>{validation(fieldState.error.message)}</FieldError> : null}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="h-11 text-base" disabled={submitting}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
