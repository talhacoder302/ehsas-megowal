import { describe, expect, it } from "vitest";
import { buildReceiptKey, isReceiptKey, MAX_UPLOAD_BYTES, optionalReceiptKeySchema, uploadRequestSchema } from "./uploads";

const random = "AbCdEfGhIjKlMnOpQrStUv";

describe("receipt keys", () => {
  it("are built from kind, month and a random part", () => {
    expect(buildReceiptKey("disbursement", "2026-10", random, "image/jpeg")).toBe(`receipts/disbursement/2026/10/${random}.jpg`);
  });

  it("only accept the app's own key format", () => {
    expect(isReceiptKey(`receipts/expense/2026/10/${random}.webp`)).toBe(true);
    expect(isReceiptKey(`receipts/expense/2026/10/${random}.webp`, "disbursement")).toBe(false);
    const bad = [
      "../secrets.txt",
      `receipts/expense/2026/13/${random}.jpg`,
      `receipts/other/2026/10/${random}.jpg`,
      "receipts/expense/2026/10/short.jpg",
      42,
    ];
    for (const value of bad) expect(isReceiptKey(value)).toBe(false);
  });

  it("treat an empty photo as none, and refuse keys of another kind", () => {
    const schema = optionalReceiptKeySchema("disbursement");
    expect(schema.parse("")).toBeNull();
    expect(schema.parse(null)).toBeNull();
    expect(schema.safeParse(`receipts/expense/2026/10/${random}.jpg`).success).toBe(false);
  });
});

describe("uploadRequestSchema", () => {
  it("accepts small photos of the allowed types", () => {
    expect(uploadRequestSchema.safeParse({ kind: "expense", contentType: "image/jpeg", size: 150_000 }).success).toBe(true);
  });

  it("refuses big files and other types", () => {
    const big = uploadRequestSchema.safeParse({ kind: "expense", contentType: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 });
    expect(big.error?.issues[0].message).toBe("photoTooLarge");
    expect(uploadRequestSchema.safeParse({ kind: "expense", contentType: "application/pdf", size: 1000 }).success).toBe(false);
  });
});
