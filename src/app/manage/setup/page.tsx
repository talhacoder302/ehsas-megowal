import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LockIcon } from "lucide-react";
import { PageHeader } from "@/components/manage/page-header";
import { BalancesStep } from "@/components/manage/setup/balances-step";
import { DatesStep } from "@/components/manage/setup/dates-step";
import { ImportPanel } from "@/components/manage/setup/import-panel";
import { MembersStep } from "@/components/manage/setup/members-step";
import { SummaryStep } from "@/components/manage/setup/summary-step";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { currentMonth, dateKey, formatMonth, todayKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/guards";
import { getSetupState } from "@/server/setup";

// Excel imports run as Server Actions of this page and may check a few thousand rows.
export const maxDuration = 60;

const STEPS = ["dates", "balances", "members", "imports", "summary"] as const;

type Props = { searchParams: Promise<{ step?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setup");
  return { title: t("title") };
}

export default async function SetupPage({ searchParams }: Props) {
  const me = await requirePageUser("/manage/setup");
  if (!can(me.role, "setup.manage")) redirect("/manage");
  const { step: requested } = await searchParams;
  const index = Math.min(Math.max(Number(typeof requested === "string" ? requested : 1) || 1, 1), STEPS.length) - 1;
  const step = STEPS[index];
  const [t, locale, state] = await Promise.all([getTranslations("setup"), getLocale(), getSetupState()]);
  const lang = locale === "ur" ? "ur" : "en";
  const registerBlocked = state.locked ? t("lockedShort") : state.firstMonth ? null : t("imports.needFirstMonth");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <nav aria-label={t("stepsLabel")}>
        <ol className="grid grid-cols-5 gap-1 text-center text-[0.7rem] sm:text-xs">
          {STEPS.map((s, i) => (
            <li key={s}>
              <Link
                href={`/manage/setup?step=${i + 1}`}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-2",
                  i === index ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span className="flex size-6 items-center justify-center rounded-full border text-[0.7rem]">{i + 1}</span>
                {t(`steps.${s}`)}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {state.locked ? (
        <Alert>
          <LockIcon />
          <AlertDescription>{t("locked", { month: state.lockedThrough ? formatMonth(state.lockedThrough, lang) : "" })}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t(`stepTitles.${step}`)}</h2>
        <p className="text-sm text-muted-foreground">{t(`stepHints.${step}`)}</p>
      </div>

      {step === "dates" ? (
        <DatesStep
          programStartDate={state.programStartDate ? dateKey(state.programStartDate) : null}
          firstMonth={state.firstMonth}
          locked={state.locked}
          today={todayKey()}
          thisMonth={currentMonth()}
        />
      ) : null}
      {step === "balances" ? <BalancesStep accounts={state.accounts} locked={state.locked} /> : null}
      {step === "members" ? <MembersStep members={state.members} locked={state.locked} today={todayKey()} /> : null}
      {step === "imports" ? (
        <div className="flex flex-col gap-4">
          <ImportPanel kind="members" title={t("imports.membersTitle")} description={t("imports.membersHint")} />
          <ImportPanel kind="history" title={t("imports.historyTitle")} description={t("imports.historyHint")} disabledReason={registerBlocked} />
          <ImportPanel kind="cases" title={t("imports.casesTitle")} description={t("imports.casesHint")} disabledReason={registerBlocked} />
        </div>
      ) : null}
      {step === "summary" ? (
        <SummaryStep reconciliation={state.reconciliation} firstMonth={state.firstMonth} completedAt={state.completedAt} locked={state.locked} />
      ) : null}
    </div>
  );
}
