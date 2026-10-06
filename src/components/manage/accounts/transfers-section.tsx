"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRightIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTransferAction } from "@/app/manage/accounts/actions";
import { formatDate, type DateKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees } from "@/lib/money";
import { transferFormSchema, type TransferFormInput, type TransferFormValues } from "@/lib/validators";
import type { AccountOption } from "@/server/accounts";
import type { TransferItem } from "@/server/expenses";

type TransfersSectionProps = { transfers: TransferItem[]; options: AccountOption[]; today: DateKey };

/** Money moved between the fund's own accounts, and the button to move more. */
export function TransfersSection({ transfers, options, today }: TransfersSectionProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{t("transfers.title")}</h2>
        <Button variant="outline" size="lg" onClick={() => setOpen(true)} disabled={options.length < 2}>
          <ArrowLeftRightIcon />
          {t("transfers.add")}
        </Button>
      </div>
      {options.length < 2 ? <p className="text-xs text-muted-foreground">{t("transfers.needTwo")}</p> : null}
      {transfers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("transfers.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {transfers.map((x) => (
            <li key={x.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-1.5 font-medium">
                  {x.fromAccountName}
                  <ArrowRightIcon className="size-3.5 rtl:-scale-x-100" />
                  {x.toAccountName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(x.date, locale)} · {t("disbursements.paidBy", { name: x.createdByName })}
                </span>
                {x.note ? <span className="text-xs">{x.note}</span> : null}
              </div>
              <span className="shrink-0 font-semibold">{formatRupees(x.amount, locale)}</span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">{open ? <TransferForm options={options} today={today} onDone={() => setOpen(false)} /> : null}</DialogContent>
      </Dialog>
    </section>
  );
}

function TransferForm({ options, today, onDone }: { options: AccountOption[]; today: DateKey; onDone: () => void }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const form = useForm<TransferFormInput, unknown, TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: { fromAccountId: options[0]?.id ?? "", toAccountId: options[1]?.id ?? "", amount: "", date: today, note: "" },
  });

  async function onSubmit(values: TransferFormValues) {
    setServerError(null);
    const result = await createTransferAction(values);
    if (!result.ok) return setServerError(result.error);
    toast.success(t("transfers.saved"));
    onDone();
  }

  const accountSelect = (name: "fromAccountId" | "toAccountId", id: string, label: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger id={id} className="h-10 w-full" aria-invalid={fieldState.invalid}>
              <SelectValue placeholder={t("payments.chooseAccount")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((a) => (
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
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("transfers.add")}</DialogTitle>
        <DialogDescription>{t("transfers.addHint")}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <FormError code={serverError} />
        {accountSelect("fromAccountId", "transfer-from", t("transfers.from"))}
        {accountSelect("toAccountId", "transfer-to", t("transfers.to"))}
        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="amount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="transfer-amount">{t("disbursements.amount")}</FieldLabel>
                <Input {...field} value={String(field.value)} id="transfer-amount" inputMode="numeric" dir="ltr" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
          <Controller
            name="date"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="transfer-date">{t("transfers.date")}</FieldLabel>
                <Input {...field} id="transfer-date" type="date" dir="ltr" max={today} className="h-10" aria-invalid={fieldState.invalid} />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
        </div>
        <Controller
          name="note"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="transfer-note">{t("payments.note")}</FieldLabel>
              <Input {...field} id="transfer-note" placeholder={t("transfers.notePlaceholder")} autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
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
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {t("transfers.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
