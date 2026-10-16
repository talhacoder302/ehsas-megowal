import { NextResponse, type NextRequest } from "next/server";
import { isMonthKey } from "@/lib/dates";
import { isStaff } from "@/lib/roles";
import { getCurrentUser } from "@/server/auth/current-user";

// GET /reports/2026-10  -> the link shared on WhatsApp and by email.
// Sends each person to the report they may see: staff to the manage screen,
// members to their portal, everyone else to the login page first.
export async function GET(request: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const query = isMonthKey(month) ? `?month=${month}` : "";
  const user = await getCurrentUser();

  if (!user) {
    const login = new URL("/login", request.nextUrl);
    login.searchParams.set("callbackUrl", `/reports/${isMonthKey(month) ? month : ""}`);
    return NextResponse.redirect(login);
  }
  const target = isStaff(user.role) ? "/manage/reports" : "/member/reports";
  return NextResponse.redirect(new URL(`${target}${query}`, request.nextUrl));
}
