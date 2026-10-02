import "server-only";
import { requireRole } from "@/lib/permissions";
import { Member, User } from "@/models";

export type MemberLinkOption = {
  id: string;
  memberNo: string;
  name: string;
  fatherName: string;
  /** The user already linked to this member, if any. */
  linkedUserId: string | null;
};

/** Members to choose from when linking a login to a member record. Admin only. */
export async function listMemberLinkOptions(): Promise<MemberLinkOption[]> {
  await requireRole("admin");

  const [members, links] = await Promise.all([
    Member.find({ status: { $ne: "deceased" } })
      .select("memberNo name fatherName")
      .sort({ memberNo: 1 })
      .lean(),
    User.find({ memberId: { $ne: null } }).select("memberId").lean(),
  ]);

  const linked = new Map(links.map((u) => [u.memberId?.toString(), u._id.toString()]));

  return members.map((m) => ({
    id: m._id.toString(),
    memberNo: m.memberNo,
    name: m.name,
    fatherName: m.fatherName,
    linkedUserId: linked.get(m._id.toString()) ?? null,
  }));
}
