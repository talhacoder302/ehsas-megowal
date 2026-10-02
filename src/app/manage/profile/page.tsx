import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileView } from "@/components/shared/profile-view";
import { getOwnProfile } from "@/server/users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("profileTitle") };
}

export default async function ManageProfilePage() {
  const profile = await getOwnProfile();
  return (
    <div className="mx-auto w-full max-w-xl">
      <ProfileView profile={profile} />
    </div>
  );
}
