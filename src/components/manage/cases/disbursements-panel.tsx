"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, HandCoinsIcon, HourglassIcon, ImageIcon, InfoIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { PhotoUpload } from "@/components/manage/photo-upload";
import { EmptyState } from "@/components/shared/empty-state";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  approveDisbursementAction,
  recordDisbursementAction,
  rejectDisbursementAction,
} from "@/app/manage/cases/actions";
import { formatDate, type DateKey } from "@/lib/dates";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees, parseRupees } from "@/lib/money";
import { needsSecondApproval, type ApprovalSettings, type ApprovalStatus } from "@/lib/payouts";
import { disbursementFormSchema, type DisbursementFormInput, type DisbursementFormValues } from "@/lib/validators";
import type { AccountOption } from "@/server/accounts";
import type { DisbursementItem } from "@/server/disbursements";

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  not_required: "hidden",
  pending: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  approved: "border-emerald-600/40 text-emerald-800 dark:text-emerald-300",
  rejected: "border-transparent bg-muted text-muted-foreground",
};

type DisbursementsPanelProps = {
  caseId: string;
  items: DisbursementItem[];
  /** The case is approved or in progress and the viewer may pay out. */
  canAdd: boolean;
  /** Approved amount minus paid and pending. */
  leftToPay: number;
  accounts: AccountOption[];
  approval: ApprovalSettings;
  uploadsEnabled: boolean;
  defaultReceiver: string;
  today: DateKey;
};

export function DisbursementsPanel(props: DisbursementsPanelProps) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState<DisbursementItem | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  async function approve(item: DisbursementItem) {
    setApproving(item.id);
    const result = await approveDisbursementAction(item.id);
    setApproving(null);
    if (!result.ok) return toast.error(t(`serverErrors.${result.error}`));
    toast.success(t("disbursements.approvedToast"));
  }

  return (
    <div className="flex flex-col gap-3">
      {props.canAdd ? (
        <Button size="lg" className="self-start" onClick={() => setAdding(true)} disabled={props.leftToPay <= 0}>
          <PlusIcon />
          {t("disbursements.add")}
        </Button>
      ) : null}
      {props.canAdd && props.leftToPay <= 0 ? <p className="text-xs text-muted-foreground">{t("disbursements.nothingLeft")}</p> : null}

      {props.items.length === 0 ? (
        <EmptyState icon={HandCoinsIcon} title={t("cases.disbursements.emptyTitle")} description={t("disbursements.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {props.items.map((d) => (
            <li
              key={d.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${d.approvalStatus === "rejected" ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.receivedByName}</span>
                    <Badge variant="outline" className={STATUS_STYLE[d.approvalStatus]}>
                      {t(`approvalStatus.${d.approvalStatus}`)}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(d.date, locale)} · {d.accountName} · {t("disbursements.paidBy", { name: d.paidByName })}
                  </span>
                  {d.note ? <span className="text-xs">{d.note}</span> : null}
                  {d.approvalStatus === "approved" && d.approvedByName ? (
                    <span className="text-xs text-muted-foreground">{t("disbursements.approvedBy", { name: d.approvedByName })}</span>
                  ) : null}
                  {d.approvalStatus === "rejected" ? (
                    <span className="text-xs">{t("disbursements.rejectedBecause", { name: d.approvedByName ?? "", reason: d.rejectReason })}</span>
                  ) : null}
                </div>
                <span className={`shrink-0 font-semibold ${d.approvalStatus === "rejected" ? "line-through" : ""}`}>
                  {formatRupees(d.amount, locale)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.photoUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={d.photoUrl} target="_blank" rel="noopener noreferrer">
                      <ImageIcon />
                      {t("disbursements.viewPhoto")}
                    </a>
                  </Button>
                ) : null}
                {d.canApprove ? (
                  <>
                    <Button size="sm" onClick={() => approve(d)} disabled={approving === d.id}>
                      {approving === d.id ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
                      {t("disbursements.approve")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejecting(d)}>
                      <XIcon />
                      {t("disbursements.reject")}
                    </Button>
                  </>
                ) : d.approvalStatus === "pending" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                    <HourglassIcon className="size-3.5" />
                    {t("disbursements.waitingOther")}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          {adding ? <DisbursementForm {...props} onDone={() => setAdding(false)} /> : null}
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={rejecting !== null}
        onOpenChange={(open) => (open ? null : setRejecting(null))}
        title={t("disbursements.rejectTitle", { amount: formatRupees(rejecting?.amount ?? 0, locale) })}
        description={t("disbursements.rejectBody")}
        confirmLabel={t("disbursements.reject")}
        destructive
        onConfirm={(input) => rejectDisbursementAction(rejecting?.id ?? "", input)}
        onDone={() => toast.success(t("disbursements.rejectedToast"))}
      />
    </div>
  );
}

function DisbursementForm({
  caseId,
  leftToPay,
  accounts,
  approval,
  uploadsEnabled,
  defaultReceiver,
  today,
  onDone,
}: DisbursementsPanelProps & { onDone: () => void }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const validation = useValidationMessage();
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const form = useForm<DisbursementFormInput, unknown, DisbursementFormValues>({
    resolver: zodResolver(disbursementFormSchema),
    defaultValues: {
      amount: "",
      date: today,
      accountId: accounts[0]?.id ?? "",
      receivedByName: defaultReceiver,
      receiptPhotoKey: null,
      note: "",
    },
  });
  const amount = parseRupees(String(useWatch({ control: form.control, name: "amount" }) ?? "")) ?? 0;
  const willWait = needsSecondApproval(approval, amount);

  async function onSubmit(values: DisbursementFormValues) {
    setServerError(null);
    const result = await recordDisbursementAction(caseId, values);
    if (!result.ok) return setServerError(result.error);
    toast.success(result.data.approvalStatus === "pending" ? t("disbursements.savedPending") : t("disbursements.saved"));
    onDone();
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("disbursements.add")}</DialogTitle>
        <DialogDescription>{t("disbursements.leftToPay", { amount: formatRupees(leftToPay, locale) })}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <FormError code={serverError} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="amount"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || amount > leftToPay}>
                <FieldLabel htmlFor="pay-out-amount">{t("disbursements.amount")}</FieldLabel>
                <Input
                  {...field}
                  value={String(field.value)}
                  id="pay-out-amount"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  className="h-10"
                  aria-invalid={fieldState.invalid || amount > leftToPay}
                />
                <FieldError>
                  {amount > leftToPay ? t("serverErrors.exceedsApproved") : validation(fieldState.error?.message)}
                </FieldError>
              </Field>
            )}
          />
          <Controller
            name="date"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="pay-out-date">{t("disbursements.datePaid")}</FieldLabel>
                <Input {...field} id="pay-out-date" type="date" dir="ltr" max={today} className="h-10" aria-invalid={fieldState.invalid} />
                <FieldError>{validation(fieldState.error?.message)}</FieldError>
              </Field>
            )}
          />
        </div>

        {willWait ? (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <InfoIcon />
            <AlertDescription>{t("disbursements.willWait", { limit: formatRupees(approval.limit, locale) })}</AlertDescription>
          </Alert>
        ) : null}

        <Controller
          name="accountId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pay-out-account">{t("disbursements.fromAccount")}</FieldLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="pay-out-account" className="h-10 w-full" aria-invalid={fieldState.invalid}>
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
          name="receivedByName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pay-out-receiver">{t("disbursements.receivedBy")}</FieldLabel>
              <Input {...field} id="pay-out-receiver" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
              {fieldState.error ? (
                <FieldError>{validation(fieldState.error.message)}</FieldError>
              ) : (
                <FieldDescription>{t("disbursements.receivedByHint")}</FieldDescription>
              )}
            </Field>
          )}
        />

        <Controller
          name="receiptPhotoKey"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>{t("photo.label")}</FieldLabel>
              <PhotoUpload
                kind="disbursement"
                value={field.value ?? null}
                onChange={field.onChange}
                enabled={uploadsEnabled}
                onBusyChange={setPhotoBusy}
              />
              <FieldError>{validation(fieldState.error?.message)}</FieldError>
            </Field>
          )}
        />

        <Controller
          name="note"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="pay-out-note">{t("payments.note")}</FieldLabel>
              <Input {...field} id="pay-out-note" autoComplete="off" className="h-10" aria-invalid={fieldState.invalid} />
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
        <Button type="submit" size="lg" disabled={submitting || photoBusy || amount > leftToPay}>
          {submitting ? <Loader2Icon className="animate-spin" /> : null}
          {willWait ? t("disbursements.saveForApproval") : t("disbursements.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
