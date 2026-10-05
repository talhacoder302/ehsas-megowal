import { getLocale, getTranslations } from "next-intl/server";
import { BanIcon, HeartHandshakeIcon } from "lucide-react";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { ReceiptView } from "@/server/payments";

/** A payment receipt as it would look on paper. Used by staff and on the public receipt link. */
export async function ReceiptCard({ receipt }: { receipt: ReceiptView }) {
  const t = await getTranslations();
  const locale = (await getLocale()) === "ur" ? "ur" : "en";

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("receipt.date"), value: formatDate(receipt.date, locale) },
    { label: t("receipt.method"), value: t(`paymentMethod.${receipt.method}`) },
    { label: t("receipt.receivedBy"), value: receipt.receivedByName || "—" },
  ];

  return (
    <article className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b bg-primary/5 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <HeartHandshakeIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">
            {receipt.programName} {receipt.villageName}
          </span>
          <span className="text-xs text-muted-foreground">{t("receipt.title")}</span>
        </div>
        <span dir="ltr" className="font-mono text-sm font-semibold">
          {receipt.receiptNumber}
        </span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {receipt.cancelled ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <BanIcon className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold uppercase tracking-wide">{t("receipt.cancelled")}</span>
              <span>{receipt.cancelReason}</span>
              {receipt.cancelledAt ? (
                <span className="text-xs">
                  {receipt.cancelledByName
                    ? t("receipt.cancelledBy", { name: receipt.cancelledByName, date: formatDate(receipt.cancelledAt, locale) })
                    : formatDate(receipt.cancelledAt, locale)}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t("receipt.member")}</span>
          <span className="text-lg font-semibold">{receipt.member.name}</span>
          <span className="text-sm text-muted-foreground">
            <span dir="ltr" className="font-mono">
              {receipt.member.memberNo}
            </span>
            {receipt.member.fatherName ? ` · ${t("members.sonOf", { name: receipt.member.fatherName })}` : ""}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("receipt.for")}</span>
          <ul className="flex flex-col divide-y rounded-lg border">
            {receipt.lines.map((line) => (
              <li key={line.month ?? "opening"} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>{line.month ? formatMonth(line.month, locale) : t("payments.openingDue")}</span>
                <span>{formatRupees(line.amount, locale)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-3 ${receipt.cancelled ? "line-through opacity-70" : ""}`}
        >
          <span className="font-medium">{t("receipt.total")}</span>
          <span className="text-2xl font-bold">{formatRupees(receipt.amount, locale)}</span>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="flex justify-between gap-3 sm:flex-col sm:justify-start sm:gap-0.5">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>

        {receipt.note ? <p className="rounded-lg bg-muted/40 p-3 text-sm">{receipt.note}</p> : null}

        <p className="text-center text-xs text-muted-foreground">{t("receipt.thanks")}</p>
      </div>
    </article>
  );
}
