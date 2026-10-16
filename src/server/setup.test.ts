import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/roles";

// The guards load Auth.js, which does not run under Vitest; each test picks the signed-in role.
let role: Role | null = null;
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => (role ? { id: "64b000000000000000000009", role, memberId: null } : null),
}));

const { completeSetup, getSetupState, saveMemberOpenings, saveOpeningBalances, saveSetupDates } = await import("./setup");
const { buildImportTemplate, previewImport, runImport } = await import("./imports");
const { REGISTER_NOTE, REGISTER_RECEIPT_PREFIX } = await import("./setup-core");
const { ContributionBill } = await import("@/models");

beforeEach(() => {
  role = null;
});

describe("who may run the opening setup", () => {
  it("keeps members out of every setup step and import", async () => {
    role = "member";
    await expect(getSetupState()).rejects.toMatchObject({ code: "forbidden" });
    await expect(saveSetupDates({})).rejects.toMatchObject({ code: "forbidden" });
    await expect(saveOpeningBalances({ accounts: [] })).rejects.toMatchObject({ code: "forbidden" });
    await expect(saveMemberOpenings({ members: [] })).rejects.toMatchObject({ code: "forbidden" });
    await expect(completeSetup()).rejects.toMatchObject({ code: "forbidden" });
    for (const kind of ["members", "history", "cases"] as const) {
      await expect(previewImport(kind, new FormData())).rejects.toMatchObject({ code: "forbidden" });
      await expect(runImport(kind, new FormData())).rejects.toMatchObject({ code: "forbidden" });
      await expect(buildImportTemplate(kind)).rejects.toMatchObject({ code: "forbidden" });
    }
  });

  it("needs a signed-in user", async () => {
    await expect(getSetupState()).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("register records", () => {
  it("are marked so they can never be mistaken for app records", () => {
    expect(REGISTER_NOTE).toBe("Imported from register");
    expect(REGISTER_RECEIPT_PREFIX).toBe("REG-");
    expect(ContributionBill.schema.path("origin").options.enum).toContain("register");
  });
});
