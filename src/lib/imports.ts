import type { ZodType } from "zod";
import { CASE_CATEGORIES, type CaseCategory } from "@/lib/cases";
import { isMonthKey, type DateKey, type MonthKey } from "@/lib/dates";
import { fromUrduDigits } from "@/lib/money";

// Reading Excel sheets from the paper register. Pure: the server reads the
// file with SheetJS and hands the rows here as plain values.

export const IMPORT_KINDS = ["members", "history", "cases"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export function isImportKind(value: unknown): value is ImportKind {
  return typeof value === "string" && (IMPORT_KINDS as readonly string[]).includes(value);
}

/** Uploads bigger than this are refused (a register of a few hundred rows is far smaller). */
export const MAX_IMPORT_BYTES = 900 * 1024;
/** Rows read from one file. */
export const MAX_IMPORT_ROWS = 2000;

type ColumnSpec = { field: string; header: string; aliases: string[]; required: boolean };

/** Columns of each template, in order. Headers are matched loosely (case, spaces and punctuation ignored). */
export const IMPORT_COLUMNS: Record<ImportKind, readonly ColumnSpec[]> = {
  members: [
    { field: "name", header: "Name", aliases: ["membername", "naam"], required: true },
    { field: "fatherName", header: "Father name", aliases: ["father", "fathersname", "walidkanaam", "walid"], required: true },
    { field: "mobile", header: "Mobile", aliases: ["phone", "mobileno", "mobilenumber", "contact"], required: false },
    { field: "mohalla", header: "Mohalla", aliases: ["muhalla", "area"], required: true },
    { field: "address", header: "Address", aliases: ["pata"], required: false },
    { field: "joinDate", header: "Join date", aliases: ["joined", "joiningdate", "datejoined"], required: true },
    { field: "openingDue", header: "Opening due", aliases: ["due", "baqaya", "pending", "unpaid", "openingbalance"], required: false },
    { field: "email", header: "Email", aliases: ["emailaddress"], required: false },
    { field: "notes", header: "Notes", aliases: ["note", "remarks"], required: false },
  ],
  history: [
    { field: "memberNo", header: "Member no", aliases: ["memberno", "membernumber", "number", "no"], required: true },
    { field: "month", header: "Month", aliases: ["mahina", "formonth"], required: true },
    { field: "amount", header: "Amount paid", aliases: ["amount", "paid", "raqam"], required: true },
    { field: "date", header: "Date paid", aliases: ["date", "paidon", "tareekh"], required: false },
  ],
  cases: [
    { field: "beneficiaryName", header: "Beneficiary name", aliases: ["beneficiary", "name", "naam"], required: true },
    { field: "category", header: "Category", aliases: ["type", "qisam"], required: true },
    { field: "guardianName", header: "Guardian", aliases: ["guardianname", "walid", "sarparast"], required: false },
    { field: "mohalla", header: "Mohalla", aliases: ["muhalla", "area"], required: false },
    { field: "description", header: "Description", aliases: ["details", "reason", "tafseel"], required: true },
    { field: "totalPaid", header: "Total paid", aliases: ["paid", "amount", "amountpaid", "raqam"], required: true },
    { field: "date", header: "Date", aliases: ["completed", "completedon", "datepaid", "tareekh"], required: true },
    { field: "showNameToMembers", header: "Show name to members", aliases: ["showname", "shownametomembers"], required: false },
  ],
};

/** "Father's name " -> "fathersname". */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, "");
}

export type SheetRow = { rowNumber: number; values: Record<string, unknown> };

/**
 * Finds the header row (the first non-empty row) and maps every later row to
 * the template's fields. Empty rows are skipped. Returns the required columns
 * that are missing.
 */
export function readSheetRows(kind: ImportKind, cells: readonly (readonly unknown[])[]): { rows: SheetRow[]; missing: string[] } {
  const columns = IMPORT_COLUMNS[kind];
  const isEmpty = (row: readonly unknown[]) => row.every((c) => String(c ?? "").trim() === "");
  const headerIndex = cells.findIndex((row) => !isEmpty(row));
  if (headerIndex === -1) return { rows: [], missing: columns.filter((c) => c.required).map((c) => c.header) };

  const headers = cells[headerIndex].map(normalizeHeader);
  const position = new Map<string, number>();
  for (const col of columns) {
    const names = [normalizeHeader(col.header), normalizeHeader(col.field), ...col.aliases];
    const index = headers.findIndex((h) => h !== "" && names.includes(h));
    if (index !== -1) position.set(col.field, index);
  }
  const missing = columns.filter((c) => c.required && !position.has(c.field)).map((c) => c.header);

  const rows: SheetRow[] = [];
  cells.slice(headerIndex + 1).forEach((row, i) => {
    if (isEmpty(row)) return;
    const values: Record<string, unknown> = {};
    for (const col of columns) {
      const index = position.get(col.field);
      values[col.field] = index === undefined ? "" : (row[index] ?? "");
    }
    // Spreadsheet row numbers start at 1 and include the header row.
    rows.push({ rowNumber: headerIndex + i + 2, values });
  });
  return { rows, missing };
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

/** Text of a cell, trimmed, with Urdu digits turned into 0-9. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return fromUrduDigits(String(value)).trim();
}

/** Excel stores dates as days since 1899-12-30. */
export function excelSerialToDateKey(serial: number): DateKey | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  return new Date(Math.round((serial - 25569) * 86_400_000)).toISOString().slice(0, 10);
}

function validDay(y: number, m: number, d: number): DateKey | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * A day as "YYYY-MM-DD" from an Excel date number or text like "2024-03-15",
 * "15/03/2024" or "15-3-2024" (day first, as written in Pakistan). Anything
 * else is returned as typed so validation reports it.
 */
export function dateCell(value: unknown): string {
  if (typeof value === "number") return excelSerialToDateKey(value) ?? String(value);
  // The server reads raw numbers, but a Date may still come from other tools: use its calendar day.
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : (validDay(value.getFullYear(), value.getMonth() + 1, value.getDate()) ?? "");
  const text = cellText(value);
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (iso) return validDay(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? text;
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (dmy) return validDay(Number(dmy[3]), Number(dmy[2]), Number(dmy[1])) ?? text;
  return text;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A month as "YYYY-MM" from "2024-03", "03/2024", "Mar 2024", "March-2024" or any date. */
export function monthCell(value: unknown): string {
  if (typeof value === "number" || value instanceof Date) return dateCell(value).slice(0, 7);
  const text = cellText(value);
  const ym = /^(\d{4})[-/.](\d{1,2})$/.exec(text);
  if (ym) {
    const key = `${ym[1]}-${ym[2].padStart(2, "0")}`;
    return isMonthKey(key) ? key : text;
  }
  const my = /^(\d{1,2})[-/.](\d{4})$/.exec(text);
  if (my) {
    const key = `${my[2]}-${my[1].padStart(2, "0")}`;
    return isMonthKey(key) ? key : text;
  }
  const named = /^([a-z]+)[\s,.-]*(\d{4})$/i.exec(text);
  if (named) {
    const index = MONTHS.indexOf(named[1].slice(0, 3).toLowerCase());
    if (index !== -1) return `${named[2]}-${String(index + 1).padStart(2, "0")}`;
  }
  const day = dateCell(value);
  return day !== text ? day.slice(0, 7) : text;
}

/** Amounts as numbers stay numbers; text is left for the rupees parser ("1,500", "Rs. 500"). */
export function amountCell(value: unknown): number | string {
  return typeof value === "number" ? value : cellText(value);
}

const YES = new Set(["yes", "y", "haan", "han", "ha", "ji", "1", "true", "ہاں", "جی"]);

export function yesNoCell(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return YES.has(cellText(value).toLowerCase());
}

const CATEGORY_WORDS: Record<string, CaseCategory> = {
  shadi: "wedding",
  marriage: "wedding",
  jahez: "wedding",
  fotgi: "funeral",
  death: "funeral",
  janaza: "funeral",
  ilaj: "medical",
  treatment: "medical",
  hospital: "medical",
  school: "education",
  fees: "education",
  fee: "education",
  schoolfees: "education",
  house: "house_repair",
  repair: "house_repair",
  ghar: "house_repair",
  rashan: "ration",
};

/** "Funeral (fotgi)", "house repair", "Shadi" -> the category key. Unknown text is returned as typed. */
export function categoryCell(value: unknown): string {
  const text = cellText(value);
  const key = normalizeHeader(text);
  const direct = CASE_CATEGORIES.find((c) => normalizeHeader(c) === key);
  if (direct) return direct;
  const prefix = CASE_CATEGORIES.find((c) => key.startsWith(normalizeHeader(c)));
  if (prefix) return prefix;
  for (const [word, category] of Object.entries(CATEGORY_WORDS)) if (key.includes(word)) return category;
  return text;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** An error on one field of one row. `code` is a key of the "validation" messages. */
export type RowError = { field: string; code: string };

/** Turns a sheet row into the shape the kind's schema expects. */
export function rowInput(kind: ImportKind, values: Record<string, unknown>): Record<string, unknown> {
  switch (kind) {
    case "members":
      return {
        name: cellText(values.name),
        fatherName: cellText(values.fatherName),
        mobile: cellText(values.mobile),
        mohalla: cellText(values.mohalla),
        address: cellText(values.address),
        joinDate: dateCell(values.joinDate),
        openingDue: amountCell(values.openingDue),
        email: cellText(values.email),
        notes: cellText(values.notes),
      };
    case "history":
      return {
        memberNo: cellText(values.memberNo),
        month: monthCell(values.month),
        amount: amountCell(values.amount),
        date: dateCell(values.date),
      };
    case "cases":
      return {
        beneficiaryName: cellText(values.beneficiaryName),
        category: categoryCell(values.category),
        guardianName: cellText(values.guardianName),
        mohalla: cellText(values.mohalla),
        description: cellText(values.description),
        totalPaid: amountCell(values.totalPaid),
        date: dateCell(values.date),
        showNameToMembers: yesNoCell(values.showNameToMembers),
      };
  }
}

/** Runs a row through its schema: the parsed values, or one error per field. */
export function validateRow<T>(schema: ZodType<T>, input: Record<string, unknown>): { data: T | null; errors: RowError[] } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data, errors: [] };
  const errors: RowError[] = [];
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (!errors.some((e) => e.field === field)) errors.push({ field, code: issue.message });
  }
  return { data: null, errors };
}

/**
 * Marks rows whose key was already seen earlier in the file (the first one is
 * kept). Rows with an empty key are ignored.
 */
export function duplicateRows(keys: readonly (string | null)[]): Set<number> {
  const seen = new Set<string>();
  const dupes = new Set<number>();
  keys.forEach((key, i) => {
    if (!key) return;
    if (seen.has(key)) dupes.add(i);
    else seen.add(key);
  });
  return dupes;
}

/** Register history must be from before the first month kept in the app. */
export function isBeforeFirstMonth(month: MonthKey, firstMonth: MonthKey): boolean {
  return month < firstMonth;
}
