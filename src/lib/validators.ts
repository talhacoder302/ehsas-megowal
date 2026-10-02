import { z } from "zod";
import { fromUrduDigits } from "@/lib/money";

// Error messages are keys in the "validation" namespace of the i18n messages.

/** "0300-1234567", "+92 300 1234567" and "923001234567" all become "03001234567". */
export function normalizeMobile(input: string): string {
  const digits = fromUrduDigits(input).replace(/[^\d+]/g, "");
  if (digits.startsWith("+92")) return `0${digits.slice(3)}`;
  if (digits.startsWith("92") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export const MOBILE_PATTERN = /^03\d{9}$/;

export const mobileSchema = z
  .string()
  .transform(normalizeMobile)
  .pipe(z.string().regex(MOBILE_PATTERN, "mobileFormat"));

export const loginSchema = z.object({
  mobile: mobileSchema,
  password: z.string().min(1, "passwordRequired"),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
