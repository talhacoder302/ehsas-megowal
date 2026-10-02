export const ROLES = ["admin", "head", "member"] as const;
export type Role = (typeof ROLES)[number];

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

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? GRANTS[role].has(permission) : false;
}

/** Admin and heads use the /manage screens. */
export function isStaff(role: Role | null | undefined): role is "admin" | "head" {
  return role === "admin" || role === "head";
}

export function homePathFor(role: Role): "/manage" | "/member" {
  return isStaff(role) ? "/manage" : "/member";
}
