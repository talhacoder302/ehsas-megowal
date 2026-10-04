import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { z } from "zod";
import type { Locale } from "@/i18n/config";

// Every date and month in the app is in Pakistan time.
export const TIME_ZONE = "Asia/Karachi";

/** A calendar month in "YYYY-MM" form, e.g. "2026-10". */
export type MonthKey = string;

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const monthSchema = z.string().regex(MONTH_PATTERN, "Month must look like YYYY-MM");

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

export function nowInPakistan(): TZDate {
  return TZDate.tz(TIME_ZONE);
}

export function toPakistanTime(date: Date | number | string): TZDate {
  return new TZDate(new Date(date).getTime(), TIME_ZONE);
}

export function monthKey(date: Date | number | string = Date.now()): MonthKey {
  return format(toPakistanTime(date), "yyyy-MM");
}

export function currentMonth(): MonthKey {
  return monthKey(Date.now());
}

function splitMonth(month: MonthKey): [number, number] {
  if (!isMonthKey(month)) throw new Error(`Invalid month: ${month}`);
  const [y, m] = month.split("-").map(Number);
  return [y, m];
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = splitMonth(month);
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const mon = (index % 12) + 1;
  return `${year}-${String(mon).padStart(2, "0")}`;
}

/** Negative if a is before b, 0 if equal, positive if after. */
export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** All months from `from` to `to`, both included. Empty if from > to. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let m = from; compareMonths(m, to) <= 0; m = shiftMonth(m, 1)) months.push(m);
  return months;
}

/** Start (inclusive) and end (exclusive) instants of a month in Pakistan time. */
export function monthRange(month: MonthKey): { start: Date; end: Date } {
  const [y, m] = splitMonth(month);
  const [ny, nm] = splitMonth(shiftMonth(month, 1));
  return {
    start: new Date(new TZDate(y, m - 1, 1, TIME_ZONE).getTime()),
    end: new Date(new TZDate(ny, nm - 1, 1, TIME_ZONE).getTime()),
  };
}

/** A calendar day in "YYYY-MM-DD" form, the value of an <input type="date">. */
export type DateKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The Pakistan calendar day of an instant, e.g. "2026-10-04". */
export function dateKey(date: Date | number | string): DateKey {
  return format(toPakistanTime(date), "yyyy-MM-dd");
}

export function todayKey(): DateKey {
  return dateKey(Date.now());
}

/** "2026-10-04" -> midnight of that day in Pakistan time. Returns null for impossible dates like "2026-02-30". */
export function parseDateKey(value: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(new TZDate(y, m - 1, d, TIME_ZONE).getTime());
  return dateKey(date) === value ? date : null;
}

/** A required "YYYY-MM-DD" day that is not after today. Messages are keys in the "validation" namespace. */
export const pastDateKeySchema = z
  .string()
  .trim()
  .min(1, { message: "dateRequired", abort: true })
  .refine((v) => parseDateKey(v) !== null, { message: "dateInvalid", abort: true })
  .refine((v) => v <= todayKey(), "dateInFuture");

function intlLocale(locale: Locale): string {
  return locale === "ur" ? "ur-PK" : "en-PK";
}

/** "October 2026" / "اکتوبر 2026" */
export function formatMonth(month: MonthKey, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(monthRange(month).start);
}

/** "3 Oct 2026" style date in Pakistan time. */
export function formatDate(date: Date | number | string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(date));
}

/** "3 Oct 2026, 4:05 pm" style date and time in Pakistan time. */
export function formatDateTime(date: Date | number | string, locale: Locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(date));
}
