import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeftIcon, FileChartColumnIcon, FileDownIcon, HandCoinsIcon, HeartHandshakeIcon, ReceiptTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMonth, formatMonthShort } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getMemberHome } from "@/server/member-portal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("member.nav");
  return { title: t("home") };
}

export default async function MemberHomePage() {
  const [t, locale, home] = await Promise.all([getTranslations(), getLocale(), getMemberHome()]);
  const lang = locale === "ur" ? "ur" : "en";
  const receipt = home.latestReceipt;

  const links = [
    { href: "/member/payments", icon: HandCoinsIcon, label: t("member.home.allPayments") },
    { href: "/member/reports", icon: FileChartColumnIcon, label: t("member.home.reportsLink") },
    { href: "/member/cases", icon: HeartHandshakeIcon, label: t("member.home.casesLink") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold">{t("member.home.greetingName", { name: home.name })}</h1>
        <p className="text-sm text-muted-foreground">
          <span dir="ltr" lang="en" className="font-mono">
            {home.memberNo}
          </span>
          {" · "}
          {t("member.home.subtitle")}
        </p>
      </div>

      <Card className={cn(home.dueNow > 0 ? "border-destructive/30" : "border-emerald-600/30")}>
        <CardContent className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t("member.home.pendingTitle")}</span>
          {home.dueNow > 0 ? (
            <>
              <span className="text-3xl font-semibold text-destructive">{formatRupees(home.dueNow, lang)}</span>
              <span className="text-xs text-muted-foreground">{t("member.home.pendingHint")}</span>
            </>
          ) : (
            <span className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">{t("member.home.nothingPending")}</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            {t("member.home.monthsPaidTitle", { year: home.year })}
            {home.monthsBilledThisYear > 0 ? (
              <span className="text-sm font-normal text-muted-foreground">
                {t("member.home.monthsPaidCount", { paid: home.monthsPaidThisYear, billed: home.monthsBilledThisYear })}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {home.monthsBilledThisYear === 0 ? (
            <p className="text-sm text-muted-foreground">{t("member.home.noMonthsYet")}</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2 text-center text-xs">
              {home.yearMonths.map(({ month, state }) => (
                <li
                  key={month}
                  className={cn(
                    "rounded-md border px-1 py-1.5",
                    state === "paid" && "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
                    state === "due" && "border-destructive/40 text-destructive",
                    state === "none" && "border-dashed text-muted-foreground",
                  )}
                >
                  {formatMonthShort(month, lang).split(" ")[0]}
                  <span className="sr-only">{` · ${t(state === "paid" ? "billStatus.paid" : state === "due" ? "billStatus.unpaid" : "member.home.notBilled")}`}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("member.home.latestReceiptTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {receipt ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span dir="ltr" lang="en" className="self-start font-mono text-sm font-medium">
                    {receipt.receiptNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(receipt.date, lang)}</span>
                  <span className="flex flex-wrap gap-1 pt-1">
                    {receipt.openingDuePaid > 0 ? <Badge variant="secondary">{t("payments.openingDueShort")}</Badge> : null}
                    {receipt.monthsCovered.map((m) => (
                      <Badge key={m} variant="secondary">
                        {formatMonth(m, lang)}
                      </Badge>
                    ))}
                  </span>
                </div>
                <span className="text-xl font-semibold">{formatRupees(receipt.amount, lang)}</span>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/receipt/${receipt.publicToken}`}>
                    <ReceiptTextIcon />
                    {t("member.home.viewReceipt")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`/receipt/${receipt.publicToken}/pdf?lang=${lang}`} target="_blank" rel="noopener noreferrer">
                    <FileDownIcon />
                    {t("member.home.downloadPdf")}
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("member.home.noReceipt")}</p>
          )}
        </CardContent>
      </Card>

      <ul className="flex flex-col gap-2">
        {links.map(({ href, icon: Icon, label }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm font-medium hover:bg-muted/50">
              <Icon className="size-5 text-primary" />
              <span className="flex-1">{label}</span>
              <ChevronLeftIcon className="size-4 text-muted-foreground ltr:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
