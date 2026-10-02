import { NextResponse, type NextRequest } from "next/server";
import { AREA_HEADER, areaFromPath } from "@/i18n/config";

// Tells the i18n config which part of the app is being rendered so member
// screens can default to Urdu. Auth checks will be added here later.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(AREA_HEADER, areaFromPath(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
