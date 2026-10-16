import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { AppError } from "@/lib/errors";
import { renderReportPdf } from "@/server/pdf/report-pdf";
import { getMonthlyReport } from "@/server/reports";

const STATUS: Partial<Record<string, number>> = { unauthenticated: 401, forbidden: 403, invalidInput: 400, monthInFuture: 400 };

// GET /api/reports/2026-10/pdf?lang=ur&version=members  -> the monthly report as a PDF.
// Any signed-in user; members always get the members version whatever they ask for.
export async function GET(request: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const lang = request.nextUrl.searchParams.get("lang");
  const locale = isLocale(lang) ? lang : "en";

  try {
    const report = await getMonthlyReport(month, request.nextUrl.searchParams.get("version"));
    const pdf = await renderReportPdf(report, locale);
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-${report.month}-${report.version}-${locale}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && STATUS[error.code]) {
      return NextResponse.json({ error: error.code }, { status: STATUS[error.code] });
    }
    console.error("[report pdf]", error);
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
