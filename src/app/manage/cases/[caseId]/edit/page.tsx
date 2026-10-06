import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CaseForm } from "@/components/manage/cases/case-form";
import { PageHeader } from "@/components/manage/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { dateKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { formatMobile } from "@/lib/validators";
import { requirePageUser } from "@/server/auth/guards";
import { getCase } from "@/server/cases";
import { listMohallas } from "@/server/members";

type Props = { params: Promise<{ caseId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cases.form");
  return { title: t("editTitle") };
}

export default async function EditCasePage({ params }: Props) {
  const { caseId } = await params;
  const me = await requirePageUser(`/manage/cases/${caseId}/edit`);
  if (!can(me.role, "cases.manage")) redirect(`/manage/cases/${caseId}`);

  const [t, aidCase, mohallas] = await Promise.all([getTranslations("cases"), getCase(caseId), listMohallas()]);
  if (!aidCase) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={t("form.editTitle")} subtitle={aidCase.caseNo} back={{ href: `/manage/cases/${aidCase.id}`, label: aidCase.caseNo }} />
      <Card>
        <CardContent>
          <CaseForm
            mohallas={mohallas}
            showNamesDefault={aidCase.showNameToMembers}
            aidCase={{
              id: aidCase.id,
              values: {
                category: aidCase.category,
                beneficiaryName: aidCase.beneficiaryName ?? "",
                guardianName: aidCase.guardianName ?? "",
                mohalla: aidCase.mohalla ?? "",
                contactMobile: aidCase.contactMobile ? formatMobile(aidCase.contactMobile) : "",
                recommendedBy: aidCase.recommendedBy,
                description: aidCase.description ?? "",
                estimatedAmount: String(aidCase.estimatedAmount),
                expectedDate: aidCase.expectedDate ? dateKey(aidCase.expectedDate) : "",
                showNameToMembers: aidCase.showNameToMembers,
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
