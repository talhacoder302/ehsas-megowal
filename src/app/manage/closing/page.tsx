import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ClosingView } from "@/components/manage/closing/closing-view";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { getClosingView } from "@/server/closing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("closing");
  return { title: t("title") };
}

export default async function ClosingPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const me = await requirePageUser("/manage/closing");
  if (!can(me.role, "months.close")) redirect("/manage");
  const { month } = await searchParams;
  const view = await getClosingView(typeof month === "string" ? month : undefined);
  return <ClosingView view={view} />;
}
