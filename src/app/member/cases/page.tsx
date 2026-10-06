import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MemberCasesView } from "@/components/member/member-cases-view";
import { listCasesForMember } from "@/server/cases";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("memberCases");
  return { title: t("title") };
}

export default async function MemberCasesPage() {
  return <MemberCasesView cases={await listCasesForMember()} />;
}
