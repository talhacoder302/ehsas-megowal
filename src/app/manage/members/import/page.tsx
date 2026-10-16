import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/manage/page-header";
import { ImportPanel } from "@/components/manage/setup/import-panel";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setup.imports");
  return { title: t("membersTitle") };
}

/** Members can be imported from Excel at any time, not only during the opening setup. */
export default async function MembersImportPage() {
  const me = await requirePageUser("/manage/members/import");
  if (!can(me.role, "members.manage")) redirect("/manage/members");
  const t = await getTranslations();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title={t("setup.imports.membersTitle")} back={{ href: "/manage/members", label: t("members.title") }} />
      <ImportPanel kind="members" title={t("setup.imports.membersTitle")} description={t("setup.imports.membersHint")} />
    </div>
  );
}
