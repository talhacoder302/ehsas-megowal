// Role constants and pure helpers. Safe to import anywhere (proxy, client, server).

export const ROLES = ["admin", "head", "member"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ["admin", "head"] as const satisfies readonly Role[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Admin and heads use the /manage screens. */
export function isStaff(role: Role | null | undefined): role is StaffRole {
  return role === "admin" || role === "head";
}

export function homePathFor(role: Role): "/manage" | "/member" {
  return isStaff(role) ? "/manage" : "/member";
}

/**
 * Who may open a page. /manage is staff only. /member is for members, and for
 * staff only when they are linked to a member record (their own account).
 */
export function canOpenPath(pathname: string, role: Role, memberId: string | null | undefined): boolean {
  if (pathname === "/manage" || pathname.startsWith("/manage/")) return isStaff(role);
  if (pathname === "/member" || pathname.startsWith("/member/")) return role === "member" || Boolean(memberId);
  return true;
}

/**
 * Only allows same-site relative paths (blocks "//evil.com" and "https://...").
 * Returns null for anything unsafe.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

/** Where to send a user after login: the requested page if they may open it, else their home. */
export function postLoginPath(role: Role, memberId: string | null | undefined, callbackUrl?: unknown): string {
  const requested = safeRedirectPath(callbackUrl);
  if (requested && requested !== "/login" && canOpenPath(requested.split("?")[0], role, memberId)) {
    return requested;
  }
  return homePathFor(role);
}
