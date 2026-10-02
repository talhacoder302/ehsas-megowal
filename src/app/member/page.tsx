import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HandCoinsIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("member.nav");
  return { title: t("home") };
}

export default async function MemberHomePage() {
  const t = await getTranslations("member.home");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("greeting")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <EmptyState icon={HandCoinsIcon} title={t("emptyTitle")} description={t("emptyBody")} />
    </div>
  );
}
