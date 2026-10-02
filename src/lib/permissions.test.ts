import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/server/auth/current-user";

const getCurrentUser = vi.fn<() => Promise<CurrentUser | null>>();

vi.mock("@/server/auth/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));

const {
  assertOwnMember,
  assertRole,
  can,
  canAccessMember,
  canSeeBeneficiaryDetails,
  requireOwnMember,
  requirePermission,
  requireRole,
  requireUser,
} = await import("./permissions");
const { AppError } = await import("./errors");
const { canOpenPath, postLoginPath, safeRedirectPath } = await import("./roles");

const MEMBER_A = "64b000000000000000000001";
const MEMBER_B = "64b000000000000000000002";

function user(role: CurrentUser["role"], memberId: string | null = null): CurrentUser {
  return {
    id: "64a000000000000000000000",
    name: "Test",
    mobile: "03001234567",
    role,
    memberId,
    language: "en",
    mustChangePassword: false,
  };
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof AppError ? error.code : "not-app-error";
  }
  return "no-error";
}

beforeEach(() => {
  getCurrentUser.mockReset();
});

describe("can", () => {
  it("gives admin everything", () => {
    expect(can("admin", "settings.manage")).toBe(true);
    expect(can("admin", "users.manage")).toBe(true);
    expect(can("admin", "payments.record")).toBe(true);
  });

  it("lets heads run the fund but not settings or users", () => {
    expect(can("head", "payments.record")).toBe(true);
    expect(can("head", "cases.viewNames")).toBe(true);
    expect(can("head", "settings.manage")).toBe(false);
    expect(can("head", "users.manage")).toBe(false);
    expect(can("head", "months.reopen")).toBe(false);
  });

  it("keeps members read-only", () => {
    expect(can("member", "own.read")).toBe(true);
    expect(can("member", "reports.view")).toBe(true);
    expect(can("member", "payments.record")).toBe(false);
    expect(can("member", "cases.viewNames")).toBe(false);
  });

  it("denies everything without a role", () => {
    expect(can(null, "own.read")).toBe(false);
  });
});

describe("assertRole / requireRole", () => {
  it("throws unauthenticated without a user", async () => {
    expect(() => assertRole(null, ["admin"])).toThrow(AppError);
    getCurrentUser.mockResolvedValue(null);
    expect(await errorCode(requireRole("admin"))).toBe("unauthenticated");
    expect(await errorCode(requireUser())).toBe("unauthenticated");
  });

  it("throws forbidden for the wrong role", async () => {
    getCurrentUser.mockResolvedValue(user("head"));
    expect(await errorCode(requireRole("admin"))).toBe("forbidden");
  });

  it("returns the user for an allowed role", async () => {
    getCurrentUser.mockResolvedValue(user("head"));
    await expect(requireRole("admin", "head")).resolves.toMatchObject({ role: "head" });
  });

  it("accepts any signed-in user when no roles are given", async () => {
    getCurrentUser.mockResolvedValue(user("member", MEMBER_A));
    await expect(requireUser()).resolves.toMatchObject({ role: "member" });
  });

  it("checks permissions through the role", async () => {
    getCurrentUser.mockResolvedValue(user("member", MEMBER_A));
    expect(await errorCode(requirePermission("payments.record"))).toBe("forbidden");
    await expect(requirePermission("own.read")).resolves.toBeTruthy();
  });
});

describe("member ownership", () => {
  it("lets a member reach only their own record", async () => {
    const member = user("member", MEMBER_A);
    expect(canAccessMember(member, MEMBER_A)).toBe(true);
    expect(canAccessMember(member, MEMBER_B)).toBe(false);

    getCurrentUser.mockResolvedValue(member);
    await expect(requireOwnMember(MEMBER_A)).resolves.toBe(member);
    expect(await errorCode(requireOwnMember(MEMBER_B))).toBe("forbidden");
  });

  it("does not let a member without a link reach any record", () => {
    expect(canAccessMember(user("member", null), MEMBER_A)).toBe(false);
  });

  it("lets staff reach any member unless staffAllowed is false", async () => {
    const head = user("head", MEMBER_A);
    expect(canAccessMember(head, MEMBER_B)).toBe(true);
    expect(canAccessMember(head, MEMBER_B, false)).toBe(false);
    expect(canAccessMember(head, MEMBER_A, false)).toBe(true);
    expect(() => assertOwnMember(head, MEMBER_B, false)).toThrow(AppError);

    getCurrentUser.mockResolvedValue(head);
    expect(await errorCode(requireOwnMember(MEMBER_B, { staffAllowed: false }))).toBe("forbidden");
  });

  it("requires a signed-in user", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await errorCode(requireOwnMember(MEMBER_A))).toBe("unauthenticated");
  });
});

describe("canSeeBeneficiaryDetails", () => {
  it("always shows names to staff", () => {
    expect(canSeeBeneficiaryDetails(user("admin"), { showNameToMembers: false })).toBe(true);
    expect(canSeeBeneficiaryDetails(user("head"), {})).toBe(true);
  });

  it("hides names from members unless the case allows it", () => {
    const member = user("member", MEMBER_A);
    expect(canSeeBeneficiaryDetails(member, { showNameToMembers: false })).toBe(false);
    expect(canSeeBeneficiaryDetails(member, {})).toBe(false);
    expect(canSeeBeneficiaryDetails(member, { showNameToMembers: null })).toBe(false);
    expect(canSeeBeneficiaryDetails(member, { showNameToMembers: true })).toBe(true);
  });

  it("hides names when nobody is signed in", () => {
    expect(canSeeBeneficiaryDetails(null, { showNameToMembers: true })).toBe(false);
  });
});

describe("routing helpers", () => {
  it("keeps members out of /manage and unlinked staff out of /member", () => {
    expect(canOpenPath("/manage/users", "member", MEMBER_A)).toBe(false);
    expect(canOpenPath("/manage", "head", null)).toBe(true);
    expect(canOpenPath("/member", "member", MEMBER_A)).toBe(true);
    expect(canOpenPath("/member", "head", null)).toBe(false);
    expect(canOpenPath("/member/profile", "admin", MEMBER_A)).toBe(true);
    expect(canOpenPath("/managers", "member", null)).toBe(true);
  });

  it("sends people home after login unless the requested page is allowed", () => {
    expect(postLoginPath("head", null)).toBe("/manage");
    expect(postLoginPath("member", MEMBER_A)).toBe("/member");
    expect(postLoginPath("head", null, "/manage/users")).toBe("/manage/users");
    expect(postLoginPath("member", MEMBER_A, "/manage/users")).toBe("/member");
    expect(postLoginPath("head", null, "/member")).toBe("/manage");
  });

  it("blocks open redirects", () => {
    expect(safeRedirectPath("//evil.com")).toBeNull();
    expect(safeRedirectPath("https://evil.com")).toBeNull();
    expect(safeRedirectPath("/\\evil.com")).toBeNull();
    expect(safeRedirectPath("/manage?x=1")).toBe("/manage?x=1");
    expect(postLoginPath("admin", null, "//evil.com")).toBe("/manage");
  });
});
