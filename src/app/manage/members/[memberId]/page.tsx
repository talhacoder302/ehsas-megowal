import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon, PencilIcon, WalletIcon } from "lucide-react";
import { ChangeStatusButton } from "@/components/manage/members/change-status-button";
import { MemberActivity } from "@/components/manage/members/member-activity";
import { MemberProfile } from "@/components/manage/members/member-profile";
import { MemberStatusBadge } from "@/components/manage/members/member-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requirePageUser } from "@/server/auth/guards";
import { getMemberDetail, listMemberActivity } from "@/server/members";

const TABS = ["profile", "contributions", "activity"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { memberId } = await params;
  const member = await getMemberDetail(memberId).catch(() => null);
  const t = await getTranslations("members");
  return { title: member ? `${member.name} (${member.memberNo})` : t("title") };
}

export default async function MemberPage({ params, searchParams }: Props) {
  const [{ memberId }, query] = await Promise.all([params, searchParams]);
  const me = await requirePageUser(`/manage/members/${memberId}`);

  const [t, member, activity] = await Promise.all([
    getTranslations("members"),
    getMemberDetail(memberId),
    listMemberActivity(memberId),
  ]);
  if (!member) notFound();

  const canManage = can(me.role, "members.manage");
  const tab: Tab = TABS.find((x) => x === query.tab) ?? "profile";
  // A new status change may not be dated before the join date or the last change.
  const lastChange = member.statusHistory[0]?.date;
  const minStatusDate = dateKey(lastChange && lastChange > member.joinDate ? lastChange : member.joinDate);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link
        href="/manage/members"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span dir="ltr" className="font-mono text-sm text-muted-foreground">
              {member.memberNo}
            </span>
            <MemberStatusBadge status={member.status} />
          </div>
          <h1 className="text-2xl font-semibold">{member.name}</h1>
          <p className="text-sm text-muted-foreground">
            {t("sonOf", { name: member.fatherName })} · {member.mohalla}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="lg">
              <Link href={`/manage/members/${member.id}/edit`}>
                <PencilIcon />
                {t("edit")}
              </Link>
            </Button>
            <ChangeStatusButton
              memberId={member.id}
              name={member.name}
              status={member.status}
              minDate={minStatusDate}
            />
          </div>
        ) : null}
      </div>

      <Tabs defaultValue={tab} className="gap-4">
        <TabsList className="w-full sm:w-auto">
          {TABS.map((x) => (
            <TabsTrigger key={x} value={x}>
              {t(`tabs.${x}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          <MemberProfile member={member} canManage={canManage} isAdmin={me.role === "admin"} />
        </TabsContent>
        <TabsContent value="contributions">
          <EmptyState icon={WalletIcon} title={t("contributions.emptyTitle")} description={t("contributions.emptyBody")} />
        </TabsContent>
        <TabsContent value="activity">
          <MemberActivity items={activity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
