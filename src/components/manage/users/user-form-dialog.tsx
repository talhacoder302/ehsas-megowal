"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUserAction, updateUserAction, type TempPasswordResult } from "@/app/manage/users/actions";
import { localeNames, locales } from "@/i18n/config";
import type { ServerErrorCode } from "@/lib/errors";
import { ROLES } from "@/lib/roles";
import { formatMobile, userFormSchema, type UserFormInput, type UserFormValues } from "@/lib/validators";
import type { MemberLinkOption } from "@/server/members";
import type { UserListItem } from "@/server/users";

// Radix Select does not allow an empty value, so "not linked" uses this sentinel.
const NO_MEMBER = "none";

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new user. */
  user: UserListItem | null;
  memberOptions: MemberLinkOption[];
  users: UserListItem[];
  onCreated: (result: TempPasswordResult) => void;
};

export function UserFormDialog(props: UserFormDialogProps) {
  // Remount the form for each user so default values are fresh.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        {props.open ? <UserForm key={props.user?.id ?? "new"} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UserForm({ user, memberOptions, users, onOpenChange, onCreated }: UserFormDialogProps) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);

  const form = useForm<UserFormInput, unknown, UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name ?? "",
      mobile: user ? formatMobile(user.mobile) : "",
      role: user?.role ?? "member",
      memberId: user?.memberId ?? "",
      language: user?.language ?? "ur",
    },
  });

  const userNames = new Map(users.map((u) => [u.id, u.name]));

  async function onSubmit(values: UserFormValues) {
    setServerError(null);
    const payload = { ...values, memberId: values.memberId ?? "" };

    if (user) {
      const result = await updateUserAction(user.id, payload);
      if (!result.ok) return setServerError(result.error);
      toast.success(t("users.updated"));
      onOpenChange(false);
    } else {
      const result = await createUserAction(payload);
      if (!result.ok) return setServerError(result.error);
      toast.success(t("users.created"));
      onOpenChange(false);
      onCreated(result.data);
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{user ? t("users.form.editTitle") : t("users.form.createTitle")}</DialogTitle>
        {user ? null : <DialogDescription>{t("users.form.createSubtitle")}</DialogDescription>}
      </DialogHeader>

      <FieldGroup>
        <FormError code={serverError} />

        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="user-name">{t("users.form.name")}</FieldLabel>
              <Input {...field} id="user-name" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="mobile"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="user-mobile">{t("users.form.mobile")}</FieldLabel>
              <Input
                {...field}
                id="user-mobile"
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

        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="role"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="user-role">{t("users.form.role")}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="user-role" className="h-10 w-full" aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />

          <Controller
            name="language"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="user-language">{t("users.form.language")}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="user-language" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locales.map((locale) => (
                      <SelectItem key={locale} value={locale} lang={locale}>
                        {localeNames[locale]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        <Controller
          name="memberId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="user-member">{t("users.form.member")}</FieldLabel>
              <Select
                value={field.value ? field.value : NO_MEMBER}
                onValueChange={(v) => field.onChange(v === NO_MEMBER ? "" : v)}
              >
                <SelectTrigger id="user-member" className="h-10 w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NO_MEMBER}>{t("users.form.noMember")}</SelectItem>
                  {memberOptions.map((m) => {
                    const linkedToOther = m.linkedUserId !== null && m.linkedUserId !== user?.id;
                    return (
                      <SelectItem key={m.id} value={m.id} disabled={linkedToOther}>
                        <span dir="ltr" className="font-mono text-xs">{m.memberNo}</span>
                        <span>{m.name}</span>
                        {linkedToOther ? (
                          <span className="text-xs text-muted-foreground">
                            ({t("users.form.linkedTo", { name: userNames.get(m.linkedUserId ?? "") ?? "?" })})
                          </span>
                        ) : null}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("users.form.memberHint")}</FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="lg">
            {t("common.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {user ? t("common.save") : t("users.form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
