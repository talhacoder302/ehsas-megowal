import "server-only";
import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";
import { requirePermission } from "@/lib/permissions";
import { monthKeySchema } from "@/lib/validators";
import { reportMessage, romanMonthLong } from "@/lib/whatsapp";
import { Member } from "@/models";
import { logActivity } from "./activity-log";
import { getMonthlyReport } from "./reports";

/** Resend accepts up to 100 emails per batch call. */
const BATCH_SIZE = 100;

/** The link that opens the report for whoever clicks it (see src/app/reports/[month]/route.ts). */
export function reportUrl(month: string): string {
  return `${getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/reports/${month}`;
}

/** Members who can get the report by email: still in the program and with an address. */
export async function countReportEmailRecipients(): Promise<number> {
  await requirePermission("reports.send");
  return Member.countDocuments({ status: { $in: ["active", "exempt"] }, email: { $nin: ["", null] } });
}

export type ReportEmailResult = { sent: number; failed: number };

/**
 * Emails the report link to every member with an email address, one email
 * each (addresses are never shown to each other). Does nothing when Resend is
 * not set up; members without an email are skipped.
 */
export async function emailMonthlyReport(monthInput: unknown): Promise<ReportEmailResult> {
  const actor = await requirePermission("reports.send");
  const month = monthKeySchema.parse(monthInput);
  const email = getServerEnv().email;
  if (!email) return { sent: 0, failed: 0 };

  const report = await getMonthlyReport(month, "members");
  const members = await Member.find({ status: { $in: ["active", "exempt"] }, email: { $nin: ["", null] } })
    .select("name email")
    .lean();
  if (members.length === 0) return { sent: 0, failed: 0 };

  const subject = `${report.programName} ${report.villageName}: ${romanMonthLong(month)} report`;
  const summary = reportMessage({
    programName: report.programName,
    villageName: report.villageName,
    month,
    collection: report.collection.amount,
    paidMembers: report.collection.paidMembers,
    activeMembers: report.collection.activeMembers,
    spent: report.figures.totalDisbursed + report.figures.totalExpenses,
    balance: report.figures.closingBalance,
    provisional: !report.closed,
    reportUrl: reportUrl(month),
  });

  const resend = new Resend(email.apiKey);
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const chunk = members.slice(i, i + BATCH_SIZE);
    const { error } = await resend.batch.send(
      chunk.map((m) => ({ from: email.from, to: m.email, subject, text: `${m.name},\n\n${summary}` })),
    );
    if (error) {
      console.error("[report email]", error);
      failed += chunk.length;
    } else {
      sent += chunk.length;
    }
  }

  await logActivity({ actorId: actor.id, action: "report.emailed", entity: "MonthlyReport", meta: { month, sent, failed } });
  return { sent, failed };
}
