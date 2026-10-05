"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CircleAlertIcon, Loader2Icon, ReceiptTextIcon } from "lucide-react";
import { toast } from "sonner";
import { MemberStatusBadge } from "@/components/manage/members/member-status-badge";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { receivePaymentAction } from "@/app/manage/payments/actions";
import {
  allocatePayment,
  amountThrough,
  PAYMENT_METHODS,
  type AccountType,
  type PayableItem,
  type PaymentMethod,
} from "@/lib/contributions";
import { formatMonth, type DateKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees, parseRupees } from "@/lib/money";
import { formatMobile, paymentFormSchema, type PaymentFormInput, type PaymentFormValues } from "@/lib/validators";
import type { PaymentContext } from "@/server/payments";

const METHOD_FOR_ACCOUNT: Record<AccountType, PaymentMethod> = {
  cash_in_hand: "cash",
  bank: "bank",
  mobile_wallet: "jazzcash",
};

/** How many advance months to show before "Show more". */
const ADVANCE_PREVIEW = 3;

export function PaymentForm({ context, today }: { context: PaymentContext; today: DateKey }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const validation = useValidationMessage();
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const [showAllAdvance, setShowAllAdvance] = useState(false);
  const { member, items, accounts } = context;

  const defaultAccount = accounts.find((a) => a.id === context.defaultAccountId);
  const form = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      memberId: member.id,
      amount: context.totalDueNow > 0 ? String(context.totalDueNow) : "",
      accountId: context.defaultAccountId ?? "",
      method: defaultAccount ? METHOD_FOR_ACCOUNT[defaultAccount.type] : "cash",
      date: today,
      note: "",
    },
  });

  const amountText = useWatch({ control: form.control, name: "amount" });
  const amount = parseRupees(String(amountText ?? "")) ?? 0;
  const { lines, leftover } = useMemo(() => allocatePayment(items, amount), [items, amount]);
  const paidByKey = new Map(lines.map((l) => [l.item.key, l.amount]));
  const maxPayable = amountThrough(items, items.length - 1);

  const dueItems = items.filter((i) => i.kind !== "advance");
  const advanceItems = items.filter((i) => i.kind === "advance");
  const visibleAdvance = showAllAdvance ? advanceItems : advanceItems.slice(0, ADVANCE_PREVIEW);

  const label = (item: PayableItem) =>
    item.kind === "opening" || !item.month ? t("payments.openingDue") : formatMonth(item.month, locale);

  function setAmount(value: number) {
    form.setValue("amount", value > 0 ? String(value) : "", { shouldValidate: form.formState.isSubmitted });
  }

  /** Ticking a row pays it and everything before it; unticking stops just before it. */
  function toggle(item: PayableItem) {
    const index = items.indexOf(item);
    const fullyPaid = (paidByKey.get(item.key) ?? 0) >= item.due;
    setAmount(amountThrough(items, fullyPaid ? index - 1 : index));
  }

  async function onSubmit(values: PaymentFormValues) {
    setServerError(null);
    const result = await receivePaymentAction(values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("payments.saved", { receipt: result.data.receiptNumber }));
    router.push(`/manage/payments/${result.data.id}?new=1`);
  }

  function row(item: PayableItem) {
    const paid = paidByKey.get(item.key) ?? 0;
    const full = paid >= item.due;
    const partial = paid > 0 && !full;
    const id = `pay-${item.key}`;
    return (
      <li key={item.key}>
        <label
          htmlFor={id}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
            full ? "border-primary/40 bg-primary/5" : partial ? "border-amber-500/40 bg-amber-500/5" : "hover:bg-muted/50"
          }`}
        >
          <Checkbox
            id={id}
            checked={full ? true : partial ? "indeterminate" : false}
            onCheckedChange={() => toggle(item)}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{label(item)}</span>
            {item.kind === "opening" ? (
              <span className="text-xs text-muted-foreground">{t("payments.openingDueHint")}</span>
            ) : null}
            {partial ? (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {t("payments.partOf", { paid: formatRupees(paid, locale), due: formatRupees(item.due, locale) })}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 font-medium">{formatRupees(item.due, locale)}</span>
        </label>
      </li>
    );
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* Member */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span dir="ltr" className="font-mono text-xs text-muted-foreground">
              {member.memberNo}
            </span>
            {member.status === "active" ? null : <MemberStatusBadge status={member.status} />}
          </div>
          <span className="truncate font-semibold">{member.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {t("members.sonOf", { name: member.fatherName })}
            {member.mobile ? (
              <>
                {" · "}
                <span dir="ltr">{formatMobile(member.mobile)}</span>
              </>
            ) : null}
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/manage/payments/new">{t("payments.changeMember")}</Link>
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>
            {t("payments.noAccounts")}{" "}
            <Link href="/manage/accounts" className="font-medium underline">
              {t("manage.nav.accounts")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* What to pay */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{t("payments.dueNow")}</span>
            <span className={context.totalDueNow > 0 ? "text-destructive" : "text-muted-foreground"}>
              {formatRupees(context.totalDueNow, locale)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {dueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("payments.nothingDue")}</p>
          ) : (
            <ul className="flex flex-col gap-2">{dueItems.map(row)}</ul>
          )}

          {advanceItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{t("payments.advance")}</span>
                <span className="text-xs text-muted-foreground">{t("payments.advanceHint")}</span>
              </div>
              <ul className="flex flex-col gap-2">{visibleAdvance.map(row)}</ul>
              {advanceItems.length > ADVANCE_PREVIEW ? (
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setShowAllAdvance((v) => !v)}>
                  {showAllAdvance ? t("payments.showFewer") : t("payments.showMore", { count: advanceItems.length - ADVANCE_PREVIEW })}
                </Button>
              ) : null}
            </div>
          ) : member.status !== "active" ? (
            <p className="text-xs text-muted-foreground">{t("payments.noAdvanceInactive")}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Amount and details */}
      <Card>
        <CardContent className="flex flex-col gap-5">
          <FieldGroup>
            <FormError code={serverError} />
            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || leftover > 0}>
                  <FieldLabel htmlFor="pay-amount">{t("payments.amount")}</FieldLabel>
                  <Input
                    {...field}
                    value={String(field.value)}
                    id="pay-amount"
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="off"
                    placeholder="0"
                    className="h-12 text-xl font-semibold"
                    aria-invalid={fieldState.invalid || leftover > 0}
                  />
                  <FieldError>
                    {leftover > 0
                      ? t("payments.tooMuch", { max: formatRupees(maxPayable, locale) })
                      : validation(fieldState.error?.message)}
                  </FieldError>
                  <div className="flex flex-wrap gap-2">
                    {context.totalDueNow > 0 ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setAmount(context.totalDueNow)}>
                        {t("payments.payAllDue")}
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAmount(0)}>
                      {t("payments.clear")}
                    </Button>
                  </div>
                </Field>
              )}
            />

            {lines.length > 0 && leftover === 0 ? (
              <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-xs text-muted-foreground">{t("payments.willPay")}</span>
                <ul className="flex flex-col gap-0.5">
                  {lines.map((l) => (
                    <li key={l.item.key} className="flex justify-between gap-3">
                      <span>
                        {label(l.item)}
                        {l.amount < l.item.due ? ` (${t("payments.part")})` : ""}
                      </span>
                      <span>{formatRupees(l.amount, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                name="accountId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="pay-account">{t("payments.account")}</FieldLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const account = accounts.find((a) => a.id === v);
                        if (account) form.setValue("method", METHOD_FOR_ACCOUNT[account.type]);
                      }}
                    >
                      <SelectTrigger id="pay-account" className="h-10 w-full" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder={t("payments.chooseAccount")} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>{validation(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="method"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="pay-method">{t("payments.method")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="pay-method" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {t(`paymentMethod.${m}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                name="date"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="pay-date">{t("payments.date")}</FieldLabel>
                    <Input {...field} id="pay-date" type="date" dir="ltr" max={today} className="h-10" aria-invalid={fieldState.invalid} />
                    <FieldError>{validation(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
              <Controller
                name="note"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="pay-note">{t("payments.note")}</FieldLabel>
                    <Input {...field} id="pay-note" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
                    <FieldError>{validation(fieldState.error?.message)}</FieldError>
                  </Field>
                )}
              />
            </div>
          </FieldGroup>

          <Button
            type="submit"
            size="lg"
            className="h-12 text-base"
            disabled={submitting || leftover > 0 || amount <= 0 || accounts.length === 0}
          >
            {submitting ? <Loader2Icon className="animate-spin" /> : <ReceiptTextIcon />}
            {amount > 0 ? t("payments.saveAmount", { amount: formatRupees(amount, locale) }) : t("payments.save")}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
