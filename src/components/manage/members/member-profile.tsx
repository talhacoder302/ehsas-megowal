import { getLocale, getTranslations } from "next-intl/server";
import { MessageCircleIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { formatMobile } from "@/lib/validators";
import { whatsappLink } from "@/lib/whatsapp";
import type { MemberDetail } from "@/server/members";
import { MemberLoginPanel } from "./member-login-panel";
import { MemberStatusBadge } from "./member-status-badge";

type MemberProfileProps = {
  member: MemberDetail;
  canManage: boolean;
  isAdmin: boolean;
};

/** Profile tab of the member page: details, app login and status history. */
export async function MemberProfile({ member, canManage, isAdmin }: MemberProfileProps) {
  const t = await getTranslations();
  const locale = (await getLocale()) === "ur" ? "ur" : "en";
  const notSet = <span className="text-muted-foreground">{t("members.notSet")}</span>;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("members.fields.memberNo"), value: <span dir="ltr" className="font-mono">{member.memberNo}</span> },
    { label: t("members.fields.fatherName"), value: member.fatherName || notSet },
    {
      label: t("members.fields.mobile"),
      value: member.mobile ? <span dir="ltr" className="font-mono">{formatMobile(member.mobile)}</span> : notSet,
    },
    { label: t("members.fields.mohalla"), value: member.mohalla || notSet },
    { label: t("members.fields.address"), value: member.address || notSet },
    { label: t("members.fields.joinDate"), value: formatDate(member.joinDate, locale) },
    {
      label: t("members.fields.status"),
      value: (
        <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <MemberStatusBadge status={member.status} />
          {member.statusChangedAt ? (
            <span className="text-xs text-muted-foreground">
              {t("members.statusSince", { date: formatDate(member.statusChangedAt, locale) })}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle>{t("members.details")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="divide-y">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                <dd className="text-end font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
          {member.notes ? (
            <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-xs text-muted-foreground">{t("members.fields.notes")}</span>
              <p className="whitespace-pre-line">{member.notes}</p>
            </div>
          ) : null}
          {member.mobile ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="lg">
                <a href={`tel:${member.mobile}`}>
                  <PhoneIcon />
                  {t("members.call")}
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={whatsappLink(member.mobile, "")} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon />
                  WhatsApp
                </a>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("members.login.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberLoginPanel
            member={{ id: member.id, name: member.name, mobile: member.mobile, status: member.status }}
            login={member.login}
            canManage={canManage}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("members.status.historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {member.statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("members.status.historyEmpty")}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {member.statusHistory.map((h) => (
                <li key={h.changedAt} className="flex flex-col gap-1 border-s-2 ps-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <MemberStatusBadge status={h.status} />
                    <span className="text-muted-foreground">{formatDate(h.date, locale)}</span>
                  </div>
                  <p>{h.reason}</p>
                  {h.changedByName ? (
                    <span className="text-xs text-muted-foreground">
                      {t("members.status.by", { name: h.changedByName })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
