import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MemberForm } from "@/components/manage/members/member-form";
import { MemberFormShell } from "@/components/manage/members/member-form-shell";
import { dateKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { formatMobile } from "@/lib/validators";
import { requirePageUser } from "@/server/auth/guards";
import { getMemberDetail, listMohallas } from "@/server/members";

type Props = { params: Promise<{ memberId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members.form");
  return { title: t("editTitle") };
}

export default async function EditMemberPage({ params }: Props) {
  const { memberId } = await params;
  const me = await requirePageUser(`/manage/members/${memberId}/edit`);
  if (!can(me.role, "members.manage")) redirect(`/manage/members/${memberId}`);

  const [t, member, mohallas] = await Promise.all([
    getTranslations("members"),
    getMemberDetail(memberId),
    listMohallas(),
  ]);
  if (!member) notFound();

  return (
    <MemberFormShell
      backHref={`/manage/members/${member.id}`}
      backLabel={member.name}
      title={t("form.editTitle")}
      subtitle={member.memberNo}
    >
      <MemberForm
        mohallas={mohallas}
        member={{
          id: member.id,
          values: {
            name: member.name,
            fatherName: member.fatherName,
            mobile: member.mobile ? formatMobile(member.mobile) : "",
            mohalla: member.mohalla,
            address: member.address,
            joinDate: dateKey(member.joinDate),
            notes: member.notes,
          },
        }}
      />
    </MemberFormShell>
  );
}
