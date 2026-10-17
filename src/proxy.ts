import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { AREA_HEADER, areaFromPath } from "@/i18n/config";
import { canOpenPath, homePathFor, isRole } from "@/lib/roles";
import { contentSecurityPolicy, originOf } from "@/lib/security";
import { authConfig } from "@/server/auth/config";

// Uses the database-free Auth.js config: it only reads the JWT cookie.
// Pages and services check the database again, so this is the first gate, not the only one.
const { auth } = NextAuth(authConfig);

const LOGIN = "/login";
const CHANGE_PASSWORD = "/change-password";

export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  const area = areaFromPath(pathname);
  const user = req.auth?.user;
  const signedIn = Boolean(user?.id && isRole(user.role));
  const needsLogin = area !== "public" || pathname === CHANGE_PASSWORD;

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl));

  if (!signedIn || !user) {
    if (!needsLogin) return next();
    const url = new URL(LOGIN, req.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const home = homePathFor(user.role);

  if (user.mustChangePassword) {
    return pathname === CHANGE_PASSWORD || area === "public" && pathname !== LOGIN ? next() : redirectTo(CHANGE_PASSWORD);
  }
  if (pathname === CHANGE_PASSWORD || pathname === LOGIN) return redirectTo(home);
  if (!canOpenPath(pathname, user.role, user.memberId)) return redirectTo(home);

  return next();

  // Tells the i18n config which part of the app is rendered so member screens default to Urdu,
  // and sends the Content Security Policy with a fresh nonce (Next.js adds it to its own scripts).
  function next() {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = contentSecurityPolicy({
      nonce,
      dev: process.env.NODE_ENV === "development",
      https: process.env.NODE_ENV === "production" && (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
      connect: [originOf(process.env.R2_ENDPOINT)].filter((o): o is string => o !== null),
    });
    const headers = new Headers(req.headers);
    headers.set(AREA_HEADER, area);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
