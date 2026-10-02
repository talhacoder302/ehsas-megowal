import { NextResponse, type NextRequest } from "next/server";
import { postLoginPath } from "@/lib/roles";
import { unstable_update } from "@/server/auth";

// Re-reads the signed-in user from the database into the JWT (see the jwt
// callback), then sends them where they belong. A disabled or deleted user is
// signed out and sent to the login page.
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const session = await unstable_update({});
  const user = session?.user;

  if (!user?.id) {
    const login = new URL("/login", request.nextUrl);
    if (next) login.searchParams.set("callbackUrl", next);
    return NextResponse.redirect(login);
  }

  const target = user.mustChangePassword ? "/change-password" : postLoginPath(user.role, user.memberId, next);
  return NextResponse.redirect(new URL(target, request.nextUrl));
}
