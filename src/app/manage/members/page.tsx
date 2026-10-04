import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MembersView } from "@/components/manage/members/members-view";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listMembers } from "@/server/members";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members");
  return { title: t("title") };
}

export default async function MembersPage() {
  const me = await requirePageUser("/manage/members");
  const members = await listMembers();

  return <MembersView members={members} canManage={can(me.role, "members.manage")} />;
}
