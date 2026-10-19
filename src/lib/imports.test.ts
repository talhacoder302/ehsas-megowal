import { describe, expect, it } from "vitest";
import {
  categoryCell,
  dateCell,
  duplicateRows,
  joinAddress,
  excelSerialToDateKey,
  monthCell,
  normalizeHeader,
  readSheetRows,
  rowInput,
  validateRow,
  yesNoCell,
} from "./imports";
import { caseImportRowSchema, historyImportRowSchema, memberImportRowSchema } from "./validators";

describe("readSheetRows", () => {
  it("matches headers loosely and skips empty rows", () => {
    const { rows, missing } = readSheetRows("members", [
      [],
      ["NAME", "Father's name", "Mobile No.", "Address", "Joining date", "Baqaya"],
      ["Ali Raza", "Raza Khan", "0300-1234567", "House 12, Mohalla Arain", "15/03/2024", "1,500"],
      ["", "", "", "", "", ""],
      ["Bilal", "", "", "Mohalla Arain", "2024-04-01", ""],
    ]);
    expect(missing).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rowNumber: 3, values: { name: "Ali Raza", fatherName: "Raza Khan", address: "House 12, Mohalla Arain", openingDue: "1,500", email: "" } });
    expect(rows[1].rowNumber).toBe(5);
  });

  it("names the required columns that are missing", () => {
    expect(readSheetRows("history", [["Member no", "Amount"]]).missing).toEqual(["Month"]);
    expect(readSheetRows("cases", []).missing).toContain("Beneficiary name");
  });

  it("normalizes headers", () => {
    expect(normalizeHeader(" Father's  Name ")).toBe("fathersname");
  });
});

describe("cells", () => {
  it("reads Excel date numbers and day-first text", () => {
    expect(excelSerialToDateKey(45366)).toBe("2024-03-15");
    expect(dateCell(45366)).toBe("2024-03-15");
    expect(dateCell("15/03/2024")).toBe("2024-03-15");
    expect(dateCell("5-3-2024")).toBe("2024-03-05");
    expect(dateCell("2024-3-5")).toBe("2024-03-05");
    expect(dateCell("31/02/2024")).toBe("31/02/2024");
    expect(dateCell("")).toBe("");
  });

  it("reads months in the ways registers write them", () => {
    expect(monthCell("2024-03")).toBe("2024-03");
    expect(monthCell("3/2024")).toBe("2024-03");
    expect(monthCell("March 2024")).toBe("2024-03");
    expect(monthCell("Mar-2024")).toBe("2024-03");
    expect(monthCell(45366)).toBe("2024-03");
    expect(monthCell("۲۰۲۴-۰۳")).toBe("2024-03");
    expect(monthCell("13/2024")).toBe("13/2024");
  });

  it("finds categories from keys, labels and Roman Urdu words", () => {
    expect(categoryCell("Funeral (fotgi)")).toBe("funeral");
    expect(categoryCell("house repair")).toBe("house_repair");
    expect(categoryCell("Shadi")).toBe("wedding");
    expect(categoryCell("Other need")).toBe("other");
    expect(categoryCell("bicycle")).toBe("bicycle");
  });

  it("understands yes in English and Urdu", () => {
    expect(yesNoCell("Yes")).toBe(true);
    expect(yesNoCell("haan")).toBe(true);
    expect(yesNoCell("ہاں")).toBe(true);
    expect(yesNoCell("")).toBe(false);
    expect(yesNoCell("no")).toBe(false);
  });
});

describe("row validation", () => {
  it("accepts a good member row and reports each bad field once", () => {
    const good = validateRow(
      memberImportRowSchema,
      rowInput("members", { name: "Ali Raza", fatherName: "Raza Khan", mobile: "0300-1234567", address: "House 12", mohalla: "Mohalla Arain", joinDate: 45366, openingDue: "" }),
    );
    expect(good.errors).toEqual([]);
    expect(good.data).toMatchObject({ mobile: "03001234567", address: "House 12, Mohalla Arain", joinDate: "2024-03-15", openingDue: 0 });

    const bad = validateRow(memberImportRowSchema, rowInput("members", { name: "", fatherName: "Raza", mobile: "12345", address: "Arain", joinDate: "31/02/2024" }));
    expect(bad.data).toBeNull();
    expect(bad.errors).toEqual([
      { field: "name", code: "nameRequired" },
      { field: "mobile", code: "mobileFormat" },
      { field: "joinDate", code: "dateInvalid" },
    ]);
  });

  it("checks register payments", () => {
    const ok = validateRow(historyImportRowSchema, rowInput("history", { memberNo: " ep-003 ", month: "Jan 2025", amount: 300, date: "" }));
    expect(ok.data).toEqual({ memberNo: "EP-003", month: "2025-01", amount: 300, date: "" });
    const bad = validateRow(historyImportRowSchema, rowInput("history", { memberNo: "EP-003", month: "someday", amount: "0" }));
    expect(bad.errors.map((e) => e.field)).toEqual(["month", "amount"]);
  });

  it("checks old cases", () => {
    const ok = validateRow(
      caseImportRowSchema,
      rowInput("cases", { beneficiaryName: "Naseem Bibi", category: "fotgi", description: "Kafan dafan", totalPaid: "25,000", date: "12/06/2025", showNameToMembers: "no" }),
    );
    expect(ok.data).toMatchObject({ category: "funeral", totalPaid: 25000, date: "2025-06-12", showNameToMembers: false });
    const bad = validateRow(caseImportRowSchema, rowInput("cases", { beneficiaryName: "X", category: "bicycle", description: "", totalPaid: "", date: "" }));
    expect(bad.errors.map((e) => e.code)).toEqual(["nameRequired", "categoryRequired", "descriptionRequired", "amountRequired", "dateRequired"]);
  });

  it("flags repeats after the first", () => {
    expect([...duplicateRows(["a", "b", "a", null, null, "b"])]).toEqual([2, 5]);
  });
});

describe("joinAddress", () => {
  it("adds an old Mohalla column to the address once", () => {
    expect(joinAddress("House 12, Gali 3", "Mohalla Arain")).toBe("House 12, Gali 3, Mohalla Arain");
    expect(joinAddress("", "Mohalla Arain")).toBe("Mohalla Arain");
    expect(joinAddress("House 12, Mohalla Arain", "mohalla arain")).toBe("House 12, Mohalla Arain");
    expect(joinAddress("House 12", "")).toBe("House 12");
  });
});
