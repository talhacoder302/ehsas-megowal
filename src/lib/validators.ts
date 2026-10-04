import { z } from "zod";
import { locales } from "@/i18n/config";
import { pastDateKeySchema } from "@/lib/dates";
import { MEMBER_STATUSES } from "@/lib/member-status";
import { fromUrduDigits } from "@/lib/money";
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
    memberId: z.union([objectIdSchema, z.literal("")]).transform((v) => v || null),
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
