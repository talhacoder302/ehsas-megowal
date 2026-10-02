import { z } from "zod";
import type { Locale } from "@/i18n/config";

// All money in the app is whole rupees stored as integers. No paisa, no floats.

export const rupeesSchema = z
  .number({ error: "Amount must be a number" })
  .int("Amount must be in whole rupees")
  .min(0, "Amount cannot be negative")
  .max(Number.MAX_SAFE_INTEGER);

export const positiveRupeesSchema = rupeesSchema.min(1, "Amount must be more than zero");

const groupFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const URDU_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

// Unicode isolates keep "-12,500" in one piece inside right-to-left text.
const LTR_ISOLATE = "⁦";
const POP_ISOLATE = "⁩";

export type FormatRupeesOptions = {
  /** Use Urdu digits (۱۲,۵۰۰) instead of 12,500. Off by default. */
  urduDigits?: boolean;
  /** Return only the grouped number without "Rs." or "روپے". */
  plain?: boolean;
};

export function isWholeRupees(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function toUrduDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => URDU_DIGITS[Number(d)]);
}

export function fromUrduDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const code = d.charCodeAt(0);
    // Extended Arabic-Indic (Urdu) is U+06F0..U+06F9, Arabic-Indic is U+0660..U+0669.
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

export function formatNumber(value: number, locale: Locale = "en", urduDigits = false): string {
  const text = groupFormatter.format(Math.round(value));
  return locale === "ur" && urduDigits ? toUrduDigits(text) : text;
}

/**
 * formatRupees(12500)        -> "Rs. 12,500"
 * formatRupees(12500, "ur")  -> "12,500 روپے"
 * formatRupees(-500)         -> "-Rs. 500"
 */
export function formatRupees(
  amount: number,
  locale: Locale = "en",
  options: FormatRupeesOptions = {},
): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = formatNumber(Math.abs(rounded), locale, options.urduDigits);

  if (options.plain) return `${sign}${digits}`;
  if (locale === "ur") return `${LTR_ISOLATE}${sign}${digits}${POP_ISOLATE} روپے`;
  return `${sign}Rs. ${digits}`;
}

/**
 * Parses user input like "12,500", "Rs. 12500" or "۱۲۵۰۰" into whole rupees.
 * Returns null for empty, negative or fractional input.
 */
export function parseRupees(input: string): number | null {
  const cleaned = fromUrduDigits(input)
    .replace(/rs\.?|روپے|pkr/gi, "")
    .replace(/[,\s٬]/g, "")
    .trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}

export function sumRupees(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}
