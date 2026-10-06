import { z } from "zod";

// Receipt photo rules shared by the browser, the server and tests.

export const RECEIPT_KINDS = ["disbursement", "expense"] as const;
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];

export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

/** Photos are compressed to about 150 KB in the browser; anything above this is refused. */
export const MAX_UPLOAD_BYTES = 1024 * 1024;

/** Target size for browser-image-compression. */
export const TARGET_UPLOAD_MB = 0.15;

const EXTENSIONS: Record<UploadContentType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function extensionFor(contentType: UploadContentType): string {
  return EXTENSIONS[contentType];
}

/** receipts/<kind>/<yyyy>/<mm>/<22 random chars>.<ext> */
export const RECEIPT_KEY_PATTERN = /^receipts\/(disbursement|expense)\/\d{4}\/(0[1-9]|1[0-2])\/[A-Za-z0-9_-]{22}\.(jpg|png|webp)$/;

export function isReceiptKey(value: unknown, kind?: ReceiptKind): value is string {
  if (typeof value !== "string" || !RECEIPT_KEY_PATTERN.test(value)) return false;
  return kind ? value.startsWith(`receipts/${kind}/`) : true;
}

/** Builds a key from its parts (the random part comes from the server). */
export function buildReceiptKey(kind: ReceiptKind, month: string, random: string, contentType: UploadContentType): string {
  const [year, mon] = month.split("-");
  return `receipts/${kind}/${year}/${mon}/${random}.${extensionFor(contentType)}`;
}

/** An optional photo on a form: "" or a receipt key of the given kind. Parses "" (and null) to null. */
export function optionalReceiptKeySchema(kind: ReceiptKind) {
  return z
    .union([z.string(), z.null()])
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isReceiptKey(v, kind), "photoInvalid");
}

export const uploadRequestSchema = z.object({
  kind: z.enum(RECEIPT_KINDS),
  contentType: z.enum(UPLOAD_CONTENT_TYPES, "photoType"),
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES, "photoTooLarge"),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
