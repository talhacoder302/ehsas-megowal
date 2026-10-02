import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UsersView } from "@/components/manage/users/users-view";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMemberLinkOptions } from "@/server/members";
import { listUsers } from "@/server/users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users");
  return { title: t("title") };
}

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (me?.role !== "admin") redirect("/manage");

  const [users, memberOptions] = await Promise.all([listUsers(), listMemberLinkOptions()]);

  return <UsersView users={users} memberOptions={memberOptions} currentUserId={me.id} />;
}
