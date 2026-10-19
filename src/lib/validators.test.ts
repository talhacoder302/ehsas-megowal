import { describe, expect, it } from "vitest";
import {
  formatMobile,
  isValidMobile,
  mobileSchema,
  mobileToInternational,
  normalizeMobile,
  accountFormSchema,
  caseFormSchema,
  cashCountFormSchema,
  disbursementFormSchema,
  expenseFormSchema,
  fundSettingsSchema,
  optionalEmailSchema,
  memberFormSchema,
  memberStatusChangeSchema,
  mobileSearchDigits,
  paymentFormSchema,
  transferFormSchema,
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

describe("memberFormSchema", () => {
  const valid = {
    name: "  Muhammad Riaz ",
    fatherName: "Noor Muhammad",
    mobile: "+92 300 1110003",
    email: "",
    address: "House 12, Gali 3, Mohalla Arain, Megowal",
    joinDate: "2023-03-01",
    notes: "",
  };

  it("trims text and normalises the mobile", () => {
    const parsed = memberFormSchema.parse(valid);
    expect(parsed.name).toBe("Muhammad Riaz");
    expect(parsed.mobile).toBe("03001110003");
  });

  it("allows a member without a phone", () => {
    expect(memberFormSchema.parse({ ...valid, mobile: "  " }).mobile).toBe("");
  });

  it("needs no mohalla: the address (optional) holds street, mohalla and house", () => {
    expect(memberFormSchema.parse({ ...valid, address: "" }).address).toBe("");
    expect(memberFormSchema.parse(valid)).not.toHaveProperty("mohalla");
  });

  it("rejects a wrong mobile, missing father name and a future join date", () => {
    const result = memberFormSchema.safeParse({
      ...valid,
      mobile: "12345",
      fatherName: "",
      joinDate: "2999-01-01",
    });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(result.error?.issues.map((i) => [i.path[0], i.message]) ?? []);
    expect(messages).toEqual({
      mobile: "mobileFormat",
      fatherName: "fatherNameRequired",
      joinDate: "dateInFuture",
    });
  });
});

describe("memberStatusChangeSchema", () => {
  it("needs a known status, a date and a reason", () => {
    expect(memberStatusChangeSchema.safeParse({ status: "left", date: "2025-06-10", reason: "Moved to Lahore" }).success).toBe(true);

    const result = memberStatusChangeSchema.safeParse({ status: "gone", date: "", reason: " " });
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toEqual(["statusRequired", "dateRequired", "reasonRequired"]);
  });
});

describe("mobileSearchDigits", () => {
  it("returns digits for phone-like queries", () => {
    expect(mobileSearchDigits("0300-111")).toBe("0300111");
    expect(mobileSearchDigits("+92 300 1110003")).toBe("03001110003");
    expect(mobileSearchDigits("۱۱۱۰")).toBe("1110");
  });

  it("ignores queries that are not phone numbers or too short", () => {
    expect(mobileSearchDigits("EP-011")).toBeNull();
    expect(mobileSearchDigits("riaz")).toBeNull();
    expect(mobileSearchDigits("03")).toBeNull();
  });
});

describe("form schemas accept their own output", () => {
  // Forms send the parsed values to Server Actions, which parse them again.
  it.each([
    ["userFormSchema", userFormSchema, { name: "Ali", mobile: "0300-1234567", role: "head", memberId: "", language: "en" }],
    [
      "memberFormSchema",
      memberFormSchema,
      { name: "Ali Raza", fatherName: "Raza Khan", mobile: "", email: " Ali@Example.com ", address: "Mohalla Arain", joinDate: "2024-01-01", notes: "" },
    ],
    ["accountFormSchema", accountFormSchema, { name: "Cash", type: "cash_in_hand", holderUserId: "", openingBalance: "1,000" }],
    [
      "paymentFormSchema",
      paymentFormSchema,
      { memberId: "64b000000000000000000001", amount: "1,500", accountId: "64b000000000000000000002", method: "cash", date: "2024-01-05", note: "" },
    ],
    [
      "caseFormSchema",
      caseFormSchema,
      {
        category: "medical",
        beneficiaryName: "Allah Ditta",
        guardianName: "",
        mohalla: "",
        contactMobile: "+92 300 1234567",
        recommendedBy: "",
        description: "Operation ka kharcha",
        estimatedAmount: "40,000",
        expectedDate: "",
        showNameToMembers: false,
      },
    ],
    [
      "disbursementFormSchema",
      disbursementFormSchema,
      { amount: "20,000", date: "2024-01-05", accountId: "64b000000000000000000002", receivedByName: "Muhammad Akram", receiptPhotoKey: "", note: "" },
    ],
    [
      "expenseFormSchema",
      expenseFormSchema,
      { category: "printing", description: "Receipt books", amount: "1,200", date: "2024-01-05", accountId: "64b000000000000000000002", receiptPhotoKey: "" },
    ],
    [
      "transferFormSchema",
      transferFormSchema,
      { fromAccountId: "64b000000000000000000002", toAccountId: "64b000000000000000000003", amount: "10000", date: "2024-01-05", note: "" },
    ],
    [
      "fundSettingsSchema",
      fundSettingsSchema,
      { emergencyReserve: "20,000", approvalEnabled: true, approvalLimit: "25000", showBeneficiaryNamesDefault: false },
    ],
    [
      "cashCountFormSchema",
      cashCountFormSchema,
      { accountId: "64b000000000000000000002", systemBalance: 120200, countedAmount: "1,20,000", note: "Khula wapas dena tha" },
    ],
  ] as const)("%s", (_name, schema, input) => {
    const once = schema.parse(input);
    expect(schema.parse(once)).toEqual(once);
  });
});

describe("cashCountFormSchema", () => {
  const base = { accountId: "64b000000000000000000002", systemBalance: 120200, note: "" };

  it("needs no note when the count matches", () => {
    expect(cashCountFormSchema.parse({ ...base, countedAmount: "120,200" }).countedAmount).toBe(120200);
  });

  it("needs a note when the count does not match", () => {
    const result = cashCountFormSchema.safeParse({ ...base, countedAmount: "120000" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["note"], message: "countNoteRequired" });
    expect(cashCountFormSchema.safeParse({ ...base, countedAmount: "120000", note: "200 kam" }).success).toBe(true);
  });
});

describe("optionalEmailSchema", () => {
  it("allows no email and stores addresses in lower case", () => {
    expect(optionalEmailSchema.parse("  ")).toBe("");
    expect(optionalEmailSchema.parse(" Riaz.Megowal@Example.com ")).toBe("riaz.megowal@example.com");
  });

  it("rejects something that is not an email", () => {
    expect(optionalEmailSchema.safeParse("riaz at gmail").error?.issues[0].message).toBe("emailInvalid");
  });
});
