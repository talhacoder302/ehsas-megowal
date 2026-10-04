import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MemberForm } from "@/components/manage/members/member-form";
import { MemberFormShell } from "@/components/manage/members/member-form-shell";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { listMohallas } from "@/server/members";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members.form");
  return { title: t("createTitle") };
}

export default async function NewMemberPage() {
  const me = await requirePageUser("/manage/members/new");
  if (!can(me.role, "members.manage")) redirect("/manage/members");

  const [t, mohallas] = await Promise.all([getTranslations("members"), listMohallas()]);

  return (
    <MemberFormShell
      backHref="/manage/members"
      backLabel={t("back")}
      title={t("form.createTitle")}
      subtitle={t("form.createSubtitle")}
    >
      <MemberForm mohallas={mohallas} />
    </MemberFormShell>
  );
}
