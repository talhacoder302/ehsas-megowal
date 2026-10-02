import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LayoutDashboardIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("manage.dashboard");
  return { title: t("title") };
}

export default async function ManageDashboardPage() {
  const t = await getTranslations("manage.dashboard");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <EmptyState icon={LayoutDashboardIcon} title={t("emptyTitle")} description={t("emptyBody")} />
    </div>
  );
}
