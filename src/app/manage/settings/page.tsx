import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRightIcon, CoinsIcon, UserCheckIcon } from "lucide-react";
import { PageHeader } from "@/components/manage/page-header";
import { can } from "@/lib/permissions";
import { formatRupees } from "@/lib/money";
import { requirePageUser } from "@/server/auth/guards";
import { listRates } from "@/server/rates";
import { readSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const me = await requirePageUser("/manage/settings");
  if (!can(me.role, "settings.manage")) redirect("/manage");

  const [t, locale, rates, settings] = await Promise.all([getTranslations("settings"), getLocale(), listRates(), readSettings()]);
  const current = rates.find((r) => r.isCurrent);

  const sections = [
    {
      href: "/manage/settings/rates",
      icon: CoinsIcon,
      title: t("rates.title"),
      detail: current
        ? t("rates.currentShort", { amount: formatRupees(current.amount, locale === "ur" ? "ur" : "en") })
        : t("rates.noneShort"),
    },
    {
      href: "/manage/settings/approvals",
      icon: UserCheckIcon,
      title: t("approvals.title"),
      detail: settings.approval.enabled
        ? t("approvals.onShort", { limit: formatRupees(settings.approval.limit, locale === "ur" ? "ur" : "en") })
        : t("approvals.offShort"),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ul className="flex flex-col gap-2">
        {sections.map(({ href, icon: Icon, title, detail }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{title}</span>
                <span className="text-sm text-muted-foreground">{detail}</span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground rtl:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
