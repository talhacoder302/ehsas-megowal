import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleAlertIcon, EyeIcon, EyeOffIcon, HandCoinsIcon, MessageCircleIcon, PencilIcon, PhoneIcon } from "lucide-react";
import { CaseNotes } from "@/components/manage/cases/case-notes";
import { CaseStatusButton } from "@/components/manage/cases/case-status-button";
import { CaseTimeline } from "@/components/manage/cases/case-timeline";
import { PageHeader } from "@/components/manage/page-header";
import { CaseCategoryLabel, CaseStatusBadge } from "@/components/shared/case-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysSince, isStale, remainingAmount } from "@/lib/cases";
import { formatDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatMobile } from "@/lib/validators";
import { whatsappLink } from "@/lib/whatsapp";
import { requirePageUser } from "@/server/auth/guards";
import { getCase } from "@/server/cases";

type Props = { params: Promise<{ caseId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { caseId } = await params;
  const aidCase = await getCase(caseId).catch(() => null);
  const t = await getTranslations("cases");
  return { title: aidCase ? aidCase.caseNo : t("title") };
}

export default async function CasePage({ params }: Props) {
  const { caseId } = await params;
  const me = await requirePageUser(`/manage/cases/${caseId}`);
  const [t, locale, aidCase] = await Promise.all([getTranslations(), getLocale(), getCase(caseId)]);
  if (!aidCase) notFound();

  const lang = locale === "ur" ? "ur" : "en";
  const canManage = can(me.role, "cases.manage");
  const stale = isStale(aidCase.status, aidCase.lastUpdateAt);
  const notSet = <span className="text-muted-foreground">{t("members.notSet")}</span>;

  const money = [
    { label: t("cases.money.estimated"), value: aidCase.estimatedAmount },
    { label: t("cases.money.approved"), value: aidCase.approvedAmount },
    { label: t("cases.money.paid"), value: aidCase.paidAmount },
    { label: t("cases.money.remaining"), value: remainingAmount(aidCase), strong: true },
  ];

  const info: { label: string; value: React.ReactNode }[] = [
    { label: t("cases.form.beneficiaryName"), value: aidCase.beneficiaryName || notSet },
    { label: t("cases.form.guardianName"), value: aidCase.guardianName || notSet },
    { label: t("cases.form.mohalla"), value: aidCase.mohalla || notSet },
    {
      label: t("cases.form.contactMobile"),
      value: aidCase.contactMobile ? <span dir="ltr" className="font-mono">{formatMobile(aidCase.contactMobile)}</span> : notSet,
    },
    { label: t("cases.form.recommendedBy"), value: aidCase.recommendedBy || notSet },
    { label: t("cases.form.expectedDate"), value: aidCase.expectedDate ? formatDate(aidCase.expectedDate, lang) : notSet },
    {
      label: t("cases.opened"),
      value: aidCase.createdByName
        ? t("cases.openedBy", { date: formatDate(aidCase.createdAt, lang), name: aidCase.createdByName })
        : formatDate(aidCase.createdAt, lang),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title={aidCase.beneficiaryName ?? aidCase.caseNo}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span dir="ltr" className="font-mono">
              {aidCase.caseNo}
            </span>
            <CaseStatusBadge status={aidCase.status} />
            <CaseCategoryLabel category={aidCase.category} />
          </span>
        }
        back={{ href: "/manage/cases", label: t("cases.title") }}
        actions={
          canManage ? (
            <>
              <Button asChild variant="outline" size="lg">
                <Link href={`/manage/cases/${aidCase.id}/edit`}>
                  <PencilIcon />
                  {t("members.edit")}
                </Link>
              </Button>
              <CaseStatusButton
                caseId={aidCase.id}
                caseNo={aidCase.caseNo}
                status={aidCase.status}
                nextStatuses={aidCase.nextStatuses}
                estimatedAmount={aidCase.estimatedAmount}
              />
            </>
          ) : null
        }
      />

      {aidCase.status === "on_hold" || stale ? (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <CircleAlertIcon className="text-amber-700" />
          <AlertDescription>
            {stale ? t("cases.staleFlag", { days: daysSince(aidCase.lastUpdateAt) }) : t("cases.onHoldFlag")}
            {aidCase.lastReason ? ` · ${aidCase.lastReason}` : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {money.map((m) => (
          <div key={m.label} className={`flex flex-col gap-1 rounded-xl border p-3 ${m.strong ? "bg-primary/5" : "bg-card"}`}>
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <span className={`text-xl font-semibold ${m.value === null ? "text-muted-foreground" : ""}`}>
              {m.value === null ? "—" : formatRupees(m.value, lang)}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("cases.infoTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="divide-y">
                {info.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                    <dd className="text-end font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {aidCase.description ? (
                <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                  <span className="text-xs text-muted-foreground">{t("cases.form.description")}</span>
                  <p className="whitespace-pre-line">{aidCase.description}</p>
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-sm">
                {aidCase.showNameToMembers ? (
                  <>
                    <EyeIcon className="size-4 text-amber-600" />
                    {t("cases.namesShown")}
                  </>
                ) : (
                  <>
                    <EyeOffIcon className="size-4 text-muted-foreground" />
                    {t("cases.namesHidden")}
                  </>
                )}
              </div>
              {aidCase.contactMobile ? (
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="lg">
                    <a href={`tel:${aidCase.contactMobile}`}>
                      <PhoneIcon />
                      {t("members.call")}
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <a href={whatsappLink(aidCase.contactMobile, "")} target="_blank" rel="noopener noreferrer">
                      <MessageCircleIcon />
                      WhatsApp
                    </a>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cases.disbursements.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState icon={HandCoinsIcon} title={t("cases.disbursements.emptyTitle")} description={t("cases.disbursements.emptyBody")} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("cases.timeline.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CaseTimeline entries={aidCase.timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cases.notes.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CaseNotes caseId={aidCase.id} notes={aidCase.notes} canAdd={canManage} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
