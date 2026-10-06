"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { BanknoteIcon, LandmarkIcon, Loader2Icon, PlusIcon, SmartphoneIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/manage/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Badge } from "@/components/ui/badge";
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
import { createAccountAction } from "@/app/manage/accounts/actions";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/contributions";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { accountFormSchema, type AccountFormInput, type AccountFormValues } from "@/lib/validators";
import type { DateKey } from "@/lib/dates";
import type { AccountItem, AccountOption, StaffOption } from "@/server/accounts";
import type { TransferItem } from "@/server/expenses";
import { TransfersSection } from "./transfers-section";

const TYPE_ICONS: Record<AccountType, typeof WalletIcon> = {
  cash_in_hand: BanknoteIcon,
  bank: LandmarkIcon,
  mobile_wallet: SmartphoneIcon,
};

// Radix Select does not allow an empty value, so "nobody" uses this sentinel.
const NO_HOLDER = "none";

type AccountsViewProps = {
  accounts: AccountItem[];
  staff: StaffOption[];
  transfers: TransferItem[];
  options: AccountOption[];
  today: DateKey;
};

export function AccountsView({ accounts, staff, transfers, options, today }: AccountsViewProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  /** Lines that make up the balance; zero lines are left out except the opening balance. */
  const breakdown = (a: AccountItem): [string, number, string][] =>
    (
      [
        [t("accounts.opening"), a.openingBalance, ""],
        [t("accounts.received"), a.income, "+ "],
        [t("accounts.transfersIn"), a.transfersIn, "+ "],
        [t("accounts.disbursed"), a.disbursed, "− "],
        [t("accounts.expenses"), a.expenses, "− "],
        [t("accounts.transfersOut"), a.transfersOut, "− "],
      ] as [string, number, string][]
    ).filter(([, amount], i) => i === 0 || amount > 0);
  const [adding, setAdding] = useState(false);
  const total = accounts.filter((a) => a.active).reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title={t("accounts.title")}
        subtitle={t("accounts.subtitle")}
        actions={
          <Button size="lg" onClick={() => setAdding(true)}>
            <PlusIcon />
            {t("accounts.add")}
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState icon={WalletIcon} title={t("accounts.emptyTitle")} description={t("accounts.emptyBody")} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-primary/5 p-4">
            <span className="text-sm text-muted-foreground">{t("accounts.totalBalance")}</span>
            <span className="text-2xl font-semibold">{formatRupees(total, locale)}</span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {accounts.map((a) => {
              const Icon = TYPE_ICONS[a.type];
              return (
                <li key={a.id} className={`flex flex-col gap-3 rounded-xl border bg-card p-4 ${a.active ? "" : "opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`accountType.${a.type}`)}
                        {a.holderName ? ` · ${t("accounts.heldBy", { name: a.holderName })}` : ""}
                      </span>
                    </div>
                    {a.active ? null : <Badge variant="outline">{t("accounts.inactive")}</Badge>}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {breakdown(a).map(([label, amount, sign]) => (
                        <div key={label} className="contents">
                          <dt>{label}</dt>
                          <dd className="text-end">
                            {sign}
                            {formatRupees(amount, locale)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-muted-foreground">{t("accounts.balance")}</span>
                      <span className="text-xl font-semibold">{formatRupees(a.balance, locale)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{t("accounts.balanceNote")}</p>
        </>
      )}

      <TransfersSection transfers={transfers} options={options} today={today} />

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          {adding ? <AccountForm staff={staff} onDone={() => setAdding(false)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountForm({ staff, onDone }: { staff: StaffOption[]; onDone: () => void }) {
  const t = useTranslations();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<AccountFormInput, unknown, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { name: "", type: "cash_in_hand", holderUserId: "", openingBalance: "0" },
  });

  async function onSubmit(values: AccountFormValues) {
    setServerError(null);
    const result = await createAccountAction({ ...values, holderUserId: values.holderUserId ?? "" });
    if (!result.ok) return setServerError(result.error);
    toast.success(t("accounts.created"));
    onDone();
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("accounts.add")}</DialogTitle>
        <DialogDescription>{t("accounts.addHint")}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <FormError code={serverError} />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="account-name">{t("accounts.form.name")}</FieldLabel>
              <Input
                {...field}
                id="account-name"
                placeholder={t("accounts.form.namePlaceholder")}
                autoComplete="off"
                className="h-10"
                aria-invalid={fieldState.invalid}
              />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />
        <Controller
          name="type"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="account-type">{t("accounts.form.type")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="account-type" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`accountType.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />
        <Controller
          name="holderUserId"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="account-holder">{t("accounts.form.holder")}</FieldLabel>
              <Select value={field.value || NO_HOLDER} onValueChange={(v) => field.onChange(v === NO_HOLDER ? "" : v)}>
                <SelectTrigger id="account-holder" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_HOLDER}>{t("accounts.form.noHolder")}</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({t(`roles.${s.role}`)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("accounts.form.holderHint")}</FieldDescription>
            </Field>
          )}
        />
        <Controller
          name="openingBalance"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="account-opening">{t("accounts.form.openingBalance")}</FieldLabel>
              <Input
                {...field}
                value={String(field.value)}
                id="account-opening"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                className="h-10"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("accounts.form.openingBalanceHint")}</FieldDescription>
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
          {t("accounts.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
