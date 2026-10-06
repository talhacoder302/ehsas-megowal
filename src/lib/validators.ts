import { z } from "zod";
import { locales } from "@/i18n/config";
import { CASE_CATEGORIES, CASE_STATUSES } from "@/lib/cases";
import { ACCOUNT_TYPES, PAYMENT_METHODS } from "@/lib/contributions";
import { MONTH_PATTERN, parseDateKey, pastDateKeySchema } from "@/lib/dates";
import { MEMBER_STATUSES } from "@/lib/member-status";
import { fromUrduDigits, parseRupees } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/payouts";
import { optionalReceiptKeySchema } from "@/lib/uploads";
import { ROLES } from "@/lib/roles";

// Error messages are keys in the "validation" namespace of the i18n messages.

/**
 * Brings any common way of writing a Pakistani mobile number to 03XXXXXXXXX:
 * "0300-1234567", "+92 300 1234567", "923001234567", "0092 300 1234567",
 * "300 1234567" and Urdu digits all become "03001234567".
 * Input that does not look like a Pakistani mobile is returned as digits only
 * so validation can reject it.
 */
export function normalizeMobile(input: string): string {
  let digits = fromUrduDigits(input).replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("3")) digits = `0${digits}`;
  return digits;
}

export const MOBILE_PATTERN = /^03\d{9}$/;

export function isValidMobile(input: string): boolean {
  return MOBILE_PATTERN.test(normalizeMobile(input));
}

/** "03001234567" -> "0300-1234567" for display. */
export function formatMobile(mobile: string): string {
  return MOBILE_PATTERN.test(mobile) ? `${mobile.slice(0, 4)}-${mobile.slice(4)}` : mobile;
}

/** "03001234567" -> "923001234567" for wa.me links. */
export function mobileToInternational(mobile: string): string {
  return MOBILE_PATTERN.test(mobile) ? `92${mobile.slice(1)}` : mobile;
}

/**
 * For search boxes: the digits to look for in mobile numbers, or null when the
 * query is not a phone number (e.g. "EP-011" must not match "0300-1110001").
 */
export function mobileSearchDigits(query: string): string | null {
  if (!/^[\d۰-۹٠-٩\s+()-]+$/.test(query)) return null;
  const digits = normalizeMobile(query);
  return digits.length >= 3 ? digits : null;
}

export const mobileSchema = z
  .string()
  .transform(normalizeMobile)
  .pipe(z.string().regex(MOBILE_PATTERN, "mobileFormat"));

export const PASSWORD_MIN = 8;
// bcrypt only uses the first 72 bytes.
export const PASSWORD_MAX = 72;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, "passwordTooShort")
  .max(PASSWORD_MAX, "passwordTooLong");

export const loginSchema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, "passwordRequired").max(200, "passwordTooLong"),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "invalidId");

export const userFormSchema = z
  .object({
    name: z.string().trim().min(2, "nameRequired").max(80, "nameTooLong"),
    mobile: mobileSchema,
    role: z.enum(ROLES, "roleRequired"),
    memberId: z.union([objectIdSchema, z.literal(""), z.null()]).transform((v) => v || null),
    language: z.enum(locales),
  })
  .refine((v) => v.role !== "member" || v.memberId !== null, {
    message: "memberRequired",
    path: ["memberId"],
  });
export type UserFormInput = z.input<typeof userFormSchema>;
export type UserFormValues = z.output<typeof userFormSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "passwordRequired").max(200),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "passwordsDontMatch",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "passwordSameAsOld",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

/** Used on the forced change after a reset: the user just logged in with the temporary password. */
export const setPasswordSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "passwordsDontMatch",
    path: ["confirmPassword"],
  });
export type SetPasswordInput = z.input<typeof setPasswordSchema>;

export const languageSchema = z.enum(locales);
export { objectIdSchema };

/** Empty is allowed (some members have no phone); otherwise it must be a valid mobile. */
export const optionalMobileSchema = z
  .string()
  .transform((v) => (v.trim() === "" ? "" : normalizeMobile(v)))
  .pipe(z.union([z.literal(""), z.string().regex(MOBILE_PATTERN, "mobileFormat")]));

export const memberFormSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(80, "nameTooLong"),
  fatherName: z.string().trim().min(2, "fatherNameRequired").max(80, "nameTooLong"),
  mobile: optionalMobileSchema,
  mohalla: z.string().trim().min(2, "mohallaRequired").max(60, "mohallaTooLong"),
  address: z.string().trim().max(200, "addressTooLong"),
  joinDate: pastDateKeySchema,
  notes: z.string().trim().max(1000, "notesTooLong"),
});
export type MemberFormInput = z.input<typeof memberFormSchema>;
export type MemberFormValues = z.output<typeof memberFormSchema>;

export const memberStatusChangeSchema = z.object({
  status: z.enum(MEMBER_STATUSES, "statusRequired"),
  date: pastDateKeySchema,
  reason: z.string().trim().min(3, "reasonRequired").max(300, "reasonTooLong"),
});
export type MemberStatusChangeInput = z.input<typeof memberStatusChangeSchema>;
export type MemberStatusChangeValues = z.output<typeof memberStatusChangeSchema>;

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

export const monthKeySchema = z.string().trim().regex(MONTH_PATTERN, "monthInvalid");

/** Whole rupees typed as text ("12,500", "Rs. 500", Urdu digits) or given as a number. */
function rupeesInput(options: { min: number }) {
  return z
    .union([z.number(), z.string()])
    .transform((v, ctx) => {
      const value = typeof v === "number" ? v : v.trim() === "" ? null : parseRupees(v);
      if (value === null || !Number.isSafeInteger(value)) {
        ctx.addIssue({ code: "custom", message: typeof v === "string" && v.trim() === "" ? "amountRequired" : "amountInvalid" });
        return z.NEVER;
      }
      return value;
    })
    .pipe(z.number().min(options.min, options.min > 0 ? "amountTooSmall" : "amountInvalid").max(100_000_000, "amountTooLarge"));
}

export const reasonSchema = z.string().trim().min(3, "reasonRequired").max(300, "reasonTooLong");

export const rateFormSchema = z.object({
  amount: rupeesInput({ min: 1 }),
  effectiveFrom: monthKeySchema,
  note: z.string().trim().max(200, "notesTooLong"),
});
export type RateFormInput = z.input<typeof rateFormSchema>;
export type RateFormValues = z.output<typeof rateFormSchema>;

export const accountFormSchema = z.object({
  name: z.string().trim().min(2, "nameRequired").max(60, "nameTooLong"),
  type: z.enum(ACCOUNT_TYPES, "accountTypeRequired"),
  holderUserId: z.union([objectIdSchema, z.literal(""), z.null()]).transform((v) => v || null),
  openingBalance: rupeesInput({ min: 0 }),
});
export type AccountFormInput = z.input<typeof accountFormSchema>;
export type AccountFormValues = z.output<typeof accountFormSchema>;

export const paymentFormSchema = z.object({
  memberId: objectIdSchema,
  amount: rupeesInput({ min: 1 }),
  accountId: z.string().regex(/^[0-9a-f]{24}$/i, "accountRequired"),
  method: z.enum(PAYMENT_METHODS, "methodRequired"),
  date: pastDateKeySchema,
  note: z.string().trim().max(300, "notesTooLong"),
});
export type PaymentFormInput = z.input<typeof paymentFormSchema>;
export type PaymentFormValues = z.output<typeof paymentFormSchema>;

export const reasonFormSchema = z.object({ reason: reasonSchema });

// ---------------------------------------------------------------------------
// Aid cases
// ---------------------------------------------------------------------------

/** Empty, or a real "YYYY-MM-DD" day (past or future). */
const optionalDateKeySchema = z
  .string()
  .trim()
  .refine((v) => v === "" || parseDateKey(v) !== null, "dateInvalid");

export const caseFormSchema = z.object({
  category: z.enum(CASE_CATEGORIES, "categoryRequired"),
  beneficiaryName: z.string().trim().min(2, "nameRequired").max(80, "nameTooLong"),
  guardianName: z.string().trim().max(80, "nameTooLong"),
  mohalla: z.string().trim().max(60, "mohallaTooLong"),
  contactMobile: optionalMobileSchema,
  recommendedBy: z.string().trim().max(80, "nameTooLong"),
  description: z.string().trim().min(10, "descriptionRequired").max(2000, "descriptionTooLong"),
  estimatedAmount: rupeesInput({ min: 1 }),
  expectedDate: optionalDateKeySchema,
  showNameToMembers: z.boolean(),
});
export type CaseFormInput = z.input<typeof caseFormSchema>;
export type CaseFormValues = z.output<typeof caseFormSchema>;

export const caseStatusChangeSchema = z
  .object({
    status: z.enum(CASE_STATUSES, "statusRequired"),
    reason: reasonSchema,
    /** Only read when approving. null is what this schema itself outputs, so its output can be parsed again on the server. */
    approvedAmount: z.union([z.number(), z.string(), z.null()]),
  })
  .transform((v, ctx) => {
    if (v.status !== "approved") return { status: v.status, reason: v.reason, approvedAmount: null };
    const amount =
      typeof v.approvedAmount === "number" ? v.approvedAmount : v.approvedAmount === null ? null : parseRupees(v.approvedAmount);
    if (amount === null || amount < 1) {
      ctx.addIssue({ code: "custom", path: ["approvedAmount"], message: "approvedAmountRequired" });
      return z.NEVER;
    }
    return { status: v.status, reason: v.reason, approvedAmount: amount };
  });
export type CaseStatusChangeInput = z.input<typeof caseStatusChangeSchema>;
export type CaseStatusChangeValues = z.output<typeof caseStatusChangeSchema>;

// ---------------------------------------------------------------------------
// Money going out
// ---------------------------------------------------------------------------

const accountIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "accountRequired");

export const disbursementFormSchema = z.object({
  amount: rupeesInput({ min: 1 }),
  date: pastDateKeySchema,
  accountId: accountIdSchema,
  receivedByName: z.string().trim().min(2, "receivedByRequired").max(80, "nameTooLong"),
  receiptPhotoKey: optionalReceiptKeySchema("disbursement"),
  note: z.string().trim().max(300, "notesTooLong"),
});
export type DisbursementFormInput = z.input<typeof disbursementFormSchema>;
export type DisbursementFormValues = z.output<typeof disbursementFormSchema>;

export const approvedAmountChangeSchema = z.object({
  approvedAmount: rupeesInput({ min: 1 }),
  reason: reasonSchema,
});
export type ApprovedAmountChangeInput = z.input<typeof approvedAmountChangeSchema>;
export type ApprovedAmountChangeValues = z.output<typeof approvedAmountChangeSchema>;

export const expenseFormSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, "categoryRequired"),
  description: z.string().trim().min(3, "descriptionRequired").max(300, "descriptionTooLong"),
  amount: rupeesInput({ min: 1 }),
  date: pastDateKeySchema,
  accountId: accountIdSchema,
  receiptPhotoKey: optionalReceiptKeySchema("expense"),
});
export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
export type ExpenseFormValues = z.output<typeof expenseFormSchema>;

export const transferFormSchema = z
  .object({
    fromAccountId: accountIdSchema,
    toAccountId: accountIdSchema,
    amount: rupeesInput({ min: 1 }),
    date: pastDateKeySchema,
    note: z.string().trim().max(300, "notesTooLong"),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { message: "sameAccount", path: ["toAccountId"] });
export type TransferFormInput = z.input<typeof transferFormSchema>;
export type TransferFormValues = z.output<typeof transferFormSchema>;

export const approvalSettingsSchema = z.object({
  enabled: z.boolean(),
  limit: rupeesInput({ min: 0 }),
});
export type ApprovalSettingsInput = z.input<typeof approvalSettingsSchema>;

export const caseNoteSchema = z.object({ text: z.string().trim().min(2, "noteRequired").max(1000, "notesTooLong") });
export type CaseNoteInput = z.input<typeof caseNoteSchema>;
export type ReasonFormInput = z.input<typeof reasonFormSchema>;
