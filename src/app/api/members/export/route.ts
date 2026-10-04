import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { AppError } from "@/lib/errors";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/member-status";
import { buildMembersWorkbook } from "@/server/members-export";

// GET /api/members/export?status=active  -> members.xlsx (staff only)
export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("status");
  const status = MEMBER_STATUSES.find((s): s is MemberStatus => s === param) ?? null;

  try {
    const locale = await getLocale();
    const { filename, body } = await buildMembersWorkbook(status, locale);
    return new NextResponse(body as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "unauthenticated") {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }
    if (error instanceof AppError && error.code === "forbidden") {
      return NextResponse.json({ error: error.code }, { status: 403 });
    }
    console.error("[members export]", error);
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
