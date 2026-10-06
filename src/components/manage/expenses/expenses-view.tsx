"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { ImageIcon, Loader2Icon, PlusIcon, ReceiptIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/manage/page-header";
import { PhotoUpload } from "@/components/manage/photo-upload";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExpenseAction } from "@/app/manage/expenses/actions";
import { currentMonth, formatDate, formatMonthShort, monthKey, type DateKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/payouts";
import { expenseFormSchema, type ExpenseFormInput, type ExpenseFormValues } from "@/lib/validators";
import type { AccountOption } from "@/server/accounts";
import type { ExpenseItem } from "@/server/expenses";

type ExpensesViewProps = {
  expenses: ExpenseItem[];
  accounts: AccountOption[];
  uploadsEnabled: boolean;
  today: DateKey;
};

export function ExpensesView({ expenses, accounts, uploadsEnabled, today }: ExpensesViewProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [adding, setAdding] = useState(false);
  const thisMonth = currentMonth();
  const monthTotal = expenses.filter((e) => monthKey(e.date) === thisMonth).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title={t("expenses.title")}
        subtitle={t("expenses.subtitle", { month: formatMonthShort(thisMonth, locale), amount: formatRupees(monthTotal, locale) })}
        actions={
          <Button size="lg" onClick={() => setAdding(true)} disabled={accounts.length === 0}>
            <PlusIcon />
            {t("expenses.add")}
          </Button>
        }
      />

      {expenses.length === 0 ? (
        <EmptyState icon={ReceiptIcon} title={t("expenses.emptyTitle")} description={t("expenses.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {expenses.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t(`expenseCategory.${e.category}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(e.date, locale)}</span>
                  </div>
                  <span className="font-medium">{e.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.accountName} · {t("disbursements.paidBy", { name: e.createdByName })}
                  </span>
                </div>
                <span className="shrink-0 text-lg font-semibold">{formatRupees(e.amount, locale)}</span>
              </div>
              {e.photoUrl ? (
                <Button asChild variant="outline" size="sm" className="self-start">
                  <a href={e.photoUrl} target="_blank" rel="noopener noreferrer">
                    <ImageIcon />
                    {t("disbursements.viewPhoto")}
                  </a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          {adding ? <ExpenseForm accounts={accounts} uploadsEnabled={uploadsEnabled} today={today} onDone={() => setAdding(false)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseForm({ accounts, uploadsEnabled, today, onDone }: Omit<ExpensesViewProps, "expenses"> & { onDone: () => void }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const form = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { category: "stationery", description: "", amount: "", date: today, accountId: accounts[0]?.id ?? "", receiptPhotoKey: null },
  });

  async function onSubmit(values: ExpenseFormValues) {
    setServerError(null);
    const result = await createExpenseAction(values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("expenses.saved"));
    onDone();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("expenses.add")}</DialogTitle>
        <DialogDescription>{t("expenses.addHint")}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <FormError code={serverError} />
        <Controller
          name="category"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="expense-category">{t("expenses.category")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="expense-category" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`expenseCategory.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="expense-description">{t("expenses.description")}</FieldLabel>
              <Input {...field} id="expense-description" placeholder={t("expenses.descriptionPlaceholder")} autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="amount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="expense-amount">{t("disbursements.amount")}</FieldLabel>
                <Input {...field} value={String(field.value)} id="expense-amount" inputMode="numeric" dir="ltr" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
          <Controller
            name="date"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="expense-date">{t("disbursements.datePaid")}</FieldLabel>
                <Input {...field} id="expense-date" type="date" dir="ltr" max={today} className="h-10" aria-invalid={fieldState.invalid} />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
        </div>
        <Controller
          name="accountId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="expense-account">{t("disbursements.fromAccount")}</FieldLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="expense-account" className="h-10 w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder={t("payments.chooseAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {formatRupees(a.balance, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />
        <Controller
          name="receiptPhotoKey"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>{t("photo.label")}</FieldLabel>
              <PhotoUpload kind="expense" value={field.value ?? null} onChange={field.onChange} enabled={uploadsEnabled} onBusyChange={setPhotoBusy} />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
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
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting || photoBusy}>
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {t("expenses.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
