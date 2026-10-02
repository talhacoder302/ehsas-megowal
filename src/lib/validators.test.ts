import { describe, expect, it } from "vitest";
import {
  formatMobile,
  isValidMobile,
  mobileSchema,
  mobileToInternational,
  normalizeMobile,
  userFormSchema,
} from "./validators";

describe("normalizeMobile", () => {
  it.each([
    ["03001234567", "03001234567"],
    ["0300-1234567", "03001234567"],
    ["0300 1234567", "03001234567"],
    ["0300 123 4567", "03001234567"],
    ["+92 300 1234567", "03001234567"],
    ["+92-300-1234567", "03001234567"],
    ["+923001234567", "03001234567"],
    ["923001234567", "03001234567"],
    ["0092 300 1234567", "03001234567"],
    ["3001234567", "03001234567"],
    ["(0300) 1234567", "03001234567"],
    ["۰۳۰۰۱۲۳۴۵۶۷", "03001234567"],
    ["  0333-7654321  ", "03337654321"],
  ])("turns %s into %s", (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
  });

  it("leaves numbers that are not Pakistani mobiles as digits so validation rejects them", () => {
    expect(normalizeMobile("042-35761234")).toBe("04235761234");
    expect(isValidMobile("042-35761234")).toBe(false);
    expect(normalizeMobile("12345")).toBe("12345");
  });

  it("does not strip 92 from a number that is already 11 digits", () => {
    expect(normalizeMobile("03920000000")).toBe("03920000000");
  });
});

describe("isValidMobile", () => {
  it("accepts all common formats", () => {
    for (const input of ["03001234567", "0300-1234567", "+92 300 1234567", "923001234567"]) {
      expect(isValidMobile(input)).toBe(true);
    }
  });

  it("rejects wrong lengths and landlines", () => {
    for (const input of ["0300123456", "030012345678", "04235761234", "", "abc"]) {
      expect(isValidMobile(input)).toBe(false);
    }
  });
});

describe("mobileSchema", () => {
  it("outputs the stored form", () => {
    expect(mobileSchema.parse("+92 321 4567201")).toBe("03214567201");
  });

  it("fails with the translatable message key", () => {
    const result = mobileSchema.safeParse("0300");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("mobileFormat");
  });
});

describe("mobile display helpers", () => {
  it("formats for display and for wa.me", () => {
    expect(formatMobile("03001234567")).toBe("0300-1234567");
    expect(mobileToInternational("03001234567")).toBe("923001234567");
  });
});

describe("userFormSchema", () => {
  const base = { name: "Muhammad Riaz", mobile: "0300-1110003", language: "ur" } as const;

  it("requires a member link for the member role", () => {
    const result = userFormSchema.safeParse({ ...base, role: "member", memberId: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("memberRequired");
  });

  it("allows heads without a member link and normalises the mobile", () => {
    const result = userFormSchema.parse({ ...base, role: "head", memberId: "" });
    expect(result.memberId).toBeNull();
    expect(result.mobile).toBe("03001110003");
  });
});
