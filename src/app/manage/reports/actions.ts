"use server";

import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { emailMonthlyReport, type ReportEmailResult } from "@/server/report-email";

export async function emailReportAction(month: string): Promise<ActionResult<ReportEmailResult>> {
  return runAction(() => emailMonthlyReport(month));
}
