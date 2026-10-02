"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/i18n/messages";
import { loginSchema, type LoginInput, type LoginValues } from "@/lib/validators";

type ValidationKey = keyof Messages["validation"];

export function LoginForm() {
  const t = useTranslations("login");
  const tv = useTranslations("validation");

  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: "", password: "" },
  });

  // Sign-in is wired up with Auth.js in the next module.
  async function onSubmit() {
    toast.info(t("notReady"));
  }

  const errorText = (message: string | undefined) =>
    message ? <FieldError>{tv(message as ValidationKey)}</FieldError> : null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
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
                inputMode="numeric"
                autoComplete="username"
                dir="ltr"
                placeholder="03XXXXXXXXX"
                className="h-11 text-base"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? errorText(fieldState.error.message) : <FieldDescription>{t("mobileHint")}</FieldDescription>}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">{t("password")}</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                className="h-11 text-base"
                aria-invalid={fieldState.invalid}
              />
              {errorText(fieldState.error?.message)}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="h-11 text-base" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {form.formState.isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
