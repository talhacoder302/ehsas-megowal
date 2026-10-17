"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { BanknoteIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/manage/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordCashCountAction } from "@/app/manage/cash-count/actions";
import { countDifference } from "@/lib/closing";
import { formatDateTime } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees, parseRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { cashCountFormSchema, type CashCountFormInput, type CashCountFormValues } from "@/lib/validators";
import type { AccountOption } from "@/server/accounts";
import type { Page } from "@/lib/pagination";
import type { CashCountItem } from "@/server/cash-counts";
import { callAction } from "@/lib/offline";

/** "Matches", "Short by Rs. 200" or "Extra Rs. 300", coloured. */
function DifferenceBadge({ difference }: { difference: number }) {
  const t = useTranslations("cashCount");
  const locale = useLocale() === "ur" ? "ur" : "en";
  if (difference === 0) return <Badge className="bg-emerald-600 text-white">{t("match")}</Badge>;
  const amount = formatRupees(Math.abs(difference), locale);
  return difference < 0 ? (
    <Badge variant="destructive">{t("short", { amount })}</Badge>
  ) : (
    <Badge className="bg-amber-500 text-white">{t("extra", { amount })}</Badge>
  );
}

type CashCountViewProps = {
  accounts: AccountOption[];
  counts: Page<CashCountItem>;
  /** The account the viewer holds, chosen first. */
  defaultAccountId: string | null;
};

export function CashCountView({ accounts, counts, defaultAccountId }: CashCountViewProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title={t("cashCount.title")} subtitle={t("cashCount.subtitle")} />

      {accounts.length === 0 ? (
        <EmptyState icon={BanknoteIcon} title={t("cashCount.noAccounts")} />
      ) : (
        <CashCountForm accounts={accounts} defaultAccountId={defaultAccountId} />
      )}

      <h2 className="mt-2 text-lg font-semibold">{t("cashCount.historyTitle")}</h2>
      {counts.total === 0 ? (
        <EmptyState icon={BanknoteIcon} title={t("cashCount.emptyTitle")} description={t("cashCount.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {counts.items.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{c.accountName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(c.date, locale)} · {t("cashCount.countedBy", { name: c.countedByName })}
                  </span>
                </div>
                <DifferenceBadge difference={c.difference} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col">
                  <dt className="text-muted-foreground">{t("cashCount.appShort")}</dt>
                  <dd className="font-medium">{formatRupees(c.systemBalance, locale)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-muted-foreground">{t("cashCount.countedShort")}</dt>
                  <dd className="font-medium">{formatRupees(c.countedAmount, locale)}</dd>
                </div>
              </dl>
              {c.note ? (
                <p dir="auto" className="rounded-md bg-muted/60 px-2 py-1.5 text-xs">
                  {c.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={counts.page} pageCount={counts.pageCount} total={counts.total} basePath="/manage/cash-count" />
    </div>
  );
}

function CashCountForm({ accounts, defaultAccountId }: Omit<CashCountViewProps, "counts">) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const router = useRouter();
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const firstId = defaultAccountId ?? accounts[0].id;
  const form = useForm<CashCountFormInput, unknown, CashCountFormValues>({
    resolver: zodResolver(cashCountFormSchema),
    defaultValues: {
      accountId: firstId,
      systemBalance: accounts.find((a) => a.id === firstId)?.balance ?? 0,
      countedAmount: "",
      note: "",
    },
  });
  const accountId = useWatch({ control: form.control, name: "accountId" });
  const counted = useWatch({ control: form.control, name: "countedAmount" });
  const balance = accounts.find((a) => a.id === accountId)?.balance ?? 0;
  const countedValue = typeof counted === "number" ? counted : parseRupees(counted);
  const difference = countedValue === null ? null : countDifference(balance, countedValue);

  // The balance shown is the one the count is checked against; keep the form in step after a refresh.
  useEffect(() => {
    form.setValue("systemBalance", balance);
  }, [balance, form]);

  async function onSubmit(values: CashCountFormValues) {
    setServerError(null);
    const result = await callAction(() => recordCashCountAction(values));
    if (!result.ok) {
      setServerError(result.error);
      if (result.error === "balanceChangedMeanwhile") router.refresh();
      return;
    }
    toast.success(result.data.difference === 0 ? t("cashCount.saved") : t("cashCount.savedDifference"));
    form.reset({ accountId: values.accountId, systemBalance: balance, countedAmount: "", note: "" });
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BanknoteIcon className="size-5 text-primary" />
          {t("cashCount.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FieldGroup>
            <FormError code={serverError} />
            <Controller
              name="accountId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="count-account">{t("cashCount.account")}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="count-account" className="h-10 w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue />
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

            <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
              <span className="text-sm text-muted-foreground">{t("cashCount.systemBalance")}</span>
              <span className="text-2xl font-semibold">{formatRupees(balance, locale)}</span>
            </div>

            <Controller
              name="countedAmount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="count-amount">{t("cashCount.counted")}</FieldLabel>
                  <Input
                    {...field}
                    value={String(field.value)}
                    id="count-amount"
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="off"
                    className="h-12 text-lg"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error ? (
                    <FieldError>{validation(fieldState.error.message)}</FieldError>
                  ) : (
                    <FieldDescription>{t("cashCount.countedHint")}</FieldDescription>
                  )}
                </Field>
              )}
            />

            {difference !== null ? (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-3",
                  difference < 0 && "border-destructive/40 bg-destructive/5",
                  difference > 0 && "border-amber-500/40 bg-amber-500/5",
                )}
              >
                <span className="text-sm text-muted-foreground">{t("cashCount.difference")}</span>
                <DifferenceBadge difference={difference} />
              </div>
            ) : null}

            <Controller
              name="note"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="count-note">{t("cashCount.note")}</FieldLabel>
                  <Textarea {...field} id="count-note" dir="auto" rows={2} placeholder={t("cashCount.notePlaceholder")} aria-invalid={fieldState.invalid} />
                  {fieldState.error ? (
                    <FieldError>{validation(fieldState.error.message)}</FieldError>
                  ) : (
                    <FieldDescription>{t("cashCount.noteHint")}</FieldDescription>
                  )}
                </Field>
              )}
            />
          </FieldGroup>
          <Button type="submit" size="lg" className="self-start" disabled={submitting}>
            {submitting ? <Loader2Icon className="animate-spin" /> : null}
            {t("cashCount.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
