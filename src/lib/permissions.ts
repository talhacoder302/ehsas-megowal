import "server-only";
import { AppError } from "@/lib/errors";
import { isStaff, type Role } from "@/lib/roles";
import { getCurrentUser, type CurrentUser } from "@/server/auth/current-user";

export { ROLES, isRole, isStaff, homePathFor, type Role } from "@/lib/roles";

export const PERMISSIONS = [
  // admin only
  "settings.manage",
  "users.manage",
  "months.reopen",
  // heads (and admin)
  "members.read",
  "members.manage",
  "payments.record",
  "payments.cancel",
  "cases.manage",
  "cases.viewNames",
  "disbursements.record",
  "disbursements.approve",
  "expenses.manage",
  "transfers.manage",
  "cash.count",
  "months.close",
  "activity.view",
  // shared
  "reports.view",
  // members
  "own.read",
  "cases.viewAnonymised",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const HEAD_PERMISSIONS: readonly Permission[] = [
  "members.read",
  "members.manage",
  "payments.record",
  "payments.cancel",
  "cases.manage",
  "cases.viewNames",
  "disbursements.record",
  "disbursements.approve",
  "expenses.manage",
  "transfers.manage",
  "cash.count",
  "months.close",
  "activity.view",
  "reports.view",
  "own.read",
];

const MEMBER_PERMISSIONS: readonly Permission[] = ["own.read", "reports.view", "cases.viewAnonymised"];

const GRANTS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS),
  head: new Set(HEAD_PERMISSIONS),
  member: new Set(MEMBER_PERMISSIONS),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? GRANTS[role].has(permission) : false;
}

// ---------------------------------------------------------------------------
// Pure checks (unit tested). They throw AppError("unauthenticated" | "forbidden").
// ---------------------------------------------------------------------------

type Viewer = Pick<CurrentUser, "role" | "memberId">;

export function assertRole<U extends Viewer>(user: U | null, roles: readonly Role[]): U {
  if (!user) throw new AppError("unauthenticated");
  if (roles.length > 0 && !roles.includes(user.role)) throw new AppError("forbidden");
  return user;
}

/** Members may only touch their own member record. Staff may touch any, unless staffAllowed is false. */
export function canAccessMember(user: Viewer | null, memberId: string, staffAllowed = true): boolean {
  if (!user) return false;
  if (staffAllowed && isStaff(user.role)) return true;
  return user.memberId !== null && user.memberId === memberId;
}

export function assertOwnMember<U extends Viewer>(user: U | null, memberId: string, staffAllowed = true): U {
  if (!user) throw new AppError("unauthenticated");
  if (!canAccessMember(user, memberId, staffAllowed)) throw new AppError("forbidden");
  return user;
}

/**
 * Beneficiary name, guardian name and contact number may be shown to staff
 * always, and to members only when the case allows it.
 */
export function canSeeBeneficiaryDetails(
  user: Pick<CurrentUser, "role"> | null,
  aidCase: { showNameToMembers?: boolean | null },
): boolean {
  if (!user) return false;
  if (isStaff(user.role)) return true;
  return aidCase.showNameToMembers === true;
}

// ---------------------------------------------------------------------------
// Session-aware guards. Call one at the top of every service function.
// ---------------------------------------------------------------------------

/** The signed-in, active user. Throws "unauthenticated" otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  return assertRole(await getCurrentUser(), []);
}

/** The signed-in user if their role is one of `roles`. The role is read from the database, not the token. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  return assertRole(await getCurrentUser(), roles);
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new AppError("forbidden");
  return user;
}

/** Signed-in user who may read this member's data (the member themselves, or staff). */
export async function requireOwnMember(memberId: string, options: { staffAllowed?: boolean } = {}): Promise<CurrentUser> {
  return assertOwnMember(await getCurrentUser(), memberId, options.staffAllowed ?? true);
}
