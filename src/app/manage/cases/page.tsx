import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CasesView } from "@/components/manage/cases/cases-view";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listCases } from "@/server/cases";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cases");
  return { title: t("title") };
}

export default async function CasesPage() {
  const me = await requirePageUser("/manage/cases");
  const cases = await listCases();
  return <CasesView cases={cases} canManage={can(me.role, "cases.manage")} now={new Date().toISOString()} />;
}
