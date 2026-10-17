import "server-only";
import { Types } from "mongoose";
import * as XLSX from "xlsx";
import { dateKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import {
  Account,
  ActivityLog,
  AidCase,
  CashCount,
  ContributionBill,
  ContributionRate,
  Counter,
  Disbursement,
  Expense,
  Income,
  Member,
  MonthClosing,
  Settings,
  Transfer,
  User,
} from "@/models";
import { logActivity } from "./activity-log";
import { assertRateLimit } from "./rate-limit";
import { readSettings } from "./settings";

/** Excel refuses longer text in one cell. */
const MAX_CELL = 32_000;

/**
 * Every collection that holds the fund's records, one sheet each. Login
 * attempts and rate-limit hits are left out (they expire within a day), and
 * password hashes are never exported.
 */
const COLLECTIONS: { sheet: string; load: () => Promise<Record<string, unknown>[]> }[] = [
  { sheet: "settings", load: () => Settings.find().lean() },
  { sheet: "users", load: () => User.find().select("-passwordHash").lean() },
  { sheet: "members", load: () => Member.find().sort({ memberNo: 1 }).collation({ locale: "en", numericOrdering: true }).lean() },
  { sheet: "contribution_rates", load: () => ContributionRate.find().sort({ effectiveFrom: 1 }).lean() },
  { sheet: "contribution_bills", load: () => ContributionBill.find().sort({ month: 1 }).lean() },
  { sheet: "accounts", load: () => Account.find().sort({ createdAt: 1 }).lean() },
  { sheet: "incomes", load: () => Income.find().sort({ date: 1 }).lean() },
  { sheet: "aid_cases", load: () => AidCase.find().sort({ caseNo: 1 }).lean() },
  { sheet: "disbursements", load: () => Disbursement.find().sort({ date: 1 }).lean() },
  { sheet: "expenses", load: () => Expense.find().sort({ date: 1 }).lean() },
  { sheet: "transfers", load: () => Transfer.find().sort({ date: 1 }).lean() },
  { sheet: "cash_counts", load: () => CashCount.find().sort({ date: 1 }).lean() },
  { sheet: "month_closings", load: () => MonthClosing.find().sort({ month: 1 }).lean() },
  { sheet: "activity_logs", load: () => ActivityLog.find().sort({ createdAt: 1 }).lean() },
  { sheet: "counters", load: () => Counter.find().lean() },
];

/** One cell: ids as text, dates as ISO (UTC, exact), nested values as JSON. */
export function backupCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > MAX_CELL ? `${value.slice(0, MAX_CELL)}…` : value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  const json = JSON.stringify(value, (_key, v: unknown) => (v instanceof Types.ObjectId ? v.toString() : v));
  return json.length > MAX_CELL ? `${json.slice(0, MAX_CELL)}…` : json;
}

/** Rows of documents with one column per field seen in any of them (_id first). */
export function backupRows(docs: readonly Record<string, unknown>[]): (string | number | boolean)[][] {
  const columns: string[] = ["_id"];
  for (const doc of docs) for (const key of Object.keys(doc)) if (!columns.includes(key) && key !== "__v") columns.push(key);
  return [columns, ...docs.map((doc) => columns.map((c) => backupCell(doc[c])))];
}

/**
 * Admin: the whole database as one Excel file, so the heads can keep an
 * offline copy of the community's records. Logged.
 */
export async function buildBackupWorkbook(): Promise<{ filename: string; body: Uint8Array }> {
  const actor = await requirePermission("backup.download");
  await assertRateLimit("backup", actor.id);
  await connectDB();
  const settings = await readSettings();
  const now = new Date();

  const sheets = await Promise.all(COLLECTIONS.map(async (c) => ({ sheet: c.sheet, docs: await c.load() })));
  const book = XLSX.utils.book_new();
  const about = [
    ["Backup of", `${settings.programName} ${settings.villageName}`],
    ["Made at (UTC)", now.toISOString()],
    ["Made by", actor.name],
    ["Note", "One sheet per collection. Dates are UTC (ISO). Ids link the sheets. Password hashes are not included."],
    [],
    ["Sheet", "Rows"],
    ...sheets.map((s) => [s.sheet, s.docs.length]),
  ];
  const aboutSheet = XLSX.utils.aoa_to_sheet(about);
  aboutSheet["!cols"] = [{ wch: 22 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(book, aboutSheet, "about");
  for (const s of sheets) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(backupRows(s.docs)), s.sheet);

  const body = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer);
  await logActivity({
    actorId: actor.id,
    action: "backup.downloaded",
    entity: "Backup",
    meta: { rows: Object.fromEntries(sheets.map((s) => [s.sheet, s.docs.length])), bytes: body.byteLength },
  });
  return { filename: `ehsas-backup-${dateKey(now)}.xlsx`, body };
}
