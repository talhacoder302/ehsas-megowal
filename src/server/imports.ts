import "server-only";
import { Types } from "mongoose";
import * as XLSX from "xlsx";
import { parseDateKey, type MonthKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import {
  duplicateRows,
  IMPORT_COLUMNS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  readSheetRows,
  rowInput,
  validateRow,
  type ImportKind,
  type RowError,
} from "@/lib/imports";
import { requirePermission, type Permission } from "@/lib/permissions";
import {
  caseImportRowSchema,
  historyImportRowSchema,
  memberImportRowSchema,
  type CaseImportRow,
  type HistoryImportRow,
  type MemberImportRow,
} from "@/lib/validators";
import { AidCase, ContributionBill, Member } from "@/models";
import { logActivity } from "./activity-log";
import { nextMemberNo } from "./sequence";
import { readSettings } from "./settings";
import { assertSetupOpen, createRegisterCases, createRegisterPayments, REGISTER_NOTE } from "./setup-core";

export type ImportPreviewRow = { rowNumber: number; cells: Record<string, string>; errors: RowError[] };

export type ImportPreview = {
  kind: ImportKind;
  /** Required columns the file does not have; nothing can be imported until they are added. */
  missingColumns: string[];
  rows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
};

export type ImportResult = { created: number; skipped: number; amount: number };

/** Members can be imported any time; register history and old cases only during the opening setup. */
const PERMISSION: Record<ImportKind, Permission> = { members: "members.manage", history: "setup.manage", cases: "setup.manage" };

/** Reads the first sheet of an uploaded .xlsx, .xls or .csv file as rows of plain values. */
async function readUpload(form: FormData): Promise<unknown[][]> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new AppError("importFileMissing");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError("importFileTooLarge");
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new AppError("importFileType");
  try {
    // raw: dates stay Excel day numbers, read by dateCell() without any time zone shift.
    const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: false });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new AppError("importFileUnreadable");
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: false });
    if (rows.length > MAX_IMPORT_ROWS + 1) throw new AppError("importTooManyRows");
    return rows;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("importFileUnreadable");
  }
}

type Checked<T> = { rowNumber: number; cells: Record<string, string>; data: T | null; errors: RowError[] };

function display(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "yes" : "no") : String(v ?? "")]));
}

/** Rows of a file run through the schema and the database checks of their kind. */
async function checkRows(kind: ImportKind, form: FormData): Promise<{ missing: string[]; rows: Checked<unknown>[] }> {
  const { rows, missing } = readSheetRows(kind, await readUpload(form));
  if (kind === "members") return { missing, rows: await checkMembers(rows.map((r) => ({ r, input: rowInput(kind, r.values) }))) };
  const { firstMonth } = (await readSettings()).setup;
  if (!firstMonth) throw new AppError("setFirstMonthFirst");
  if (kind === "history") return { missing, rows: await checkHistory(rows.map((r) => ({ r, input: rowInput(kind, r.values) })), firstMonth) };
  return { missing, rows: await checkCases(rows.map((r) => ({ r, input: rowInput(kind, r.values) })), firstMonth) };
}

type Raw = { r: { rowNumber: number }; input: Record<string, unknown> };

function addError<T>(row: Checked<T>, field: string, code: string) {
  if (!row.errors.some((e) => e.field === field)) row.errors.push({ field, code });
  row.data = null;
}

async function checkMembers(raw: Raw[]): Promise<Checked<MemberImportRow>[]> {
  const rows = raw.map(({ r, input }) => ({ rowNumber: r.rowNumber, cells: display(input), ...validateRow(memberImportRowSchema, input) }));
  const existing = await Member.find().select("name fatherName mobile").lean();
  const nameKey = (name: string, father: string) => `${name.toLowerCase()}|${father.toLowerCase()}`;
  const takenNames = new Set(existing.map((m) => nameKey(m.name, m.fatherName)));
  const takenMobiles = new Set(existing.map((m) => m.mobile).filter(Boolean));
  const dupNames = duplicateRows(rows.map((row) => (row.data ? nameKey(row.data.name, row.data.fatherName) : null)));
  const dupMobiles = duplicateRows(rows.map((row) => row.data?.mobile || null));

  rows.forEach((row, i) => {
    if (!row.data) return;
    if (takenNames.has(nameKey(row.data.name, row.data.fatherName))) addError(row, "name", "memberExists");
    else if (dupNames.has(i)) addError(row, "name", "duplicateRow");
    if (row.data?.mobile && takenMobiles.has(row.data.mobile)) addError(row, "mobile", "mobileTaken");
    else if (dupMobiles.has(i)) addError(row, "mobile", "mobileDuplicate");
  });
  return rows;
}

type HistoryChecked = HistoryImportRow & { memberId: Types.ObjectId };

async function checkHistory(raw: Raw[], firstMonth: MonthKey): Promise<Checked<HistoryChecked>[]> {
  const rows: Checked<HistoryChecked>[] = raw.map(({ r, input }) => {
    const { data, errors } = validateRow(historyImportRowSchema, input);
    return { rowNumber: r.rowNumber, cells: display(input), data: data ? { ...data, memberId: new Types.ObjectId() } : null, errors };
  });
  const memberNos = [...new Set(rows.flatMap((r) => (r.data ? [r.data.memberNo] : [])))];
  const members = await Member.find({ memberNo: { $in: memberNos } }).select("memberNo").lean();
  const idOf = new Map(members.map((m) => [m.memberNo.toUpperCase(), m._id]));
  const bills = members.length
    ? await ContributionBill.find({ memberId: { $in: members.map((m) => m._id) } }).select("memberId month").lean()
    : [];
  const billed = new Set(bills.map((b) => `${b.memberId.toString()}|${b.month}`));
  const dupes = duplicateRows(rows.map((r) => (r.data ? `${r.data.memberNo}|${r.data.month}` : null)));

  rows.forEach((row, i) => {
    if (!row.data) return;
    const memberId = idOf.get(row.data.memberNo);
    if (!memberId) return addError(row, "memberNo", "memberNoNotFound");
    row.data.memberId = memberId;
    if (row.data.month >= firstMonth) return addError(row, "month", "monthNotBeforeFirst");
    if (row.data.date && row.data.date.slice(0, 7) >= firstMonth) return addError(row, "date", "dateNotBeforeFirst");
    if (billed.has(`${memberId.toString()}|${row.data.month}`)) return addError(row, "month", "billExists");
    if (dupes.has(i)) addError(row, "month", "duplicateRow");
  });
  return rows;
}

async function checkCases(raw: Raw[], firstMonth: MonthKey): Promise<Checked<CaseImportRow>[]> {
  const rows = raw.map(({ r, input }) => ({ rowNumber: r.rowNumber, cells: display(input), ...validateRow(caseImportRowSchema, input) }));
  const key = (c: { beneficiaryName: string; date: string; amount: number }) => `${c.beneficiaryName.toLowerCase()}|${c.date}|${c.amount}`;
  const imported = await AidCase.find({ importedFromRegister: true }).select("beneficiaryName lastUpdateAt registerPaidAmount").lean();
  const already = new Set(
    imported.map((c) => key({ beneficiaryName: c.beneficiaryName, date: c.lastUpdateAt.toISOString(), amount: c.registerPaidAmount })),
  );
  const dupes = duplicateRows(rows.map((r) => (r.data ? key({ beneficiaryName: r.data.beneficiaryName, date: r.data.date, amount: r.data.totalPaid }) : null)));

  rows.forEach((row, i) => {
    if (!row.data) return;
    if (row.data.date.slice(0, 7) >= firstMonth) return addError(row, "date", "dateNotBeforeFirst");
    const day = parseDateKey(row.data.date);
    if (day && already.has(key({ beneficiaryName: row.data.beneficiaryName, date: day.toISOString(), amount: row.data.totalPaid }))) {
      return addError(row, "beneficiaryName", "caseExists");
    }
    if (dupes.has(i)) addError(row, "beneficiaryName", "duplicateRow");
  });
  return rows;
}

/** Reads the file and shows every row with its problems. Nothing is saved. */
export async function previewImport(kind: ImportKind, form: FormData): Promise<ImportPreview> {
  await requirePermission(PERMISSION[kind]);
  if (kind !== "members") await assertSetupOpen();
  const { missing, rows } = await checkRows(kind, form);
  const valid = missing.length ? 0 : rows.filter((r) => r.data).length;
  return {
    kind,
    missingColumns: missing,
    rows: rows.map(({ rowNumber, cells, errors }) => ({ rowNumber, cells, errors })),
    validCount: valid,
    errorCount: rows.length - rows.filter((r) => r.data).length,
  };
}

/** Reads the same file again, checks it again and saves the valid rows. Rows with problems are skipped. */
export async function runImport(kind: ImportKind, form: FormData): Promise<ImportResult> {
  const actor = await requirePermission(PERMISSION[kind]);
  if (kind !== "members") await assertSetupOpen();
  const { missing, rows } = await checkRows(kind, form);
  if (missing.length) throw new AppError("importColumnsMissing");
  const skippedBadRows = rows.filter((r) => !r.data).length;

  if (kind === "members") {
    const valid = rows.flatMap((r) => (r.data ? [r.data as MemberImportRow] : []));
    let created = 0;
    for (const m of valid) {
      const joinDate = parseDateKey(m.joinDate);
      if (!joinDate) continue;
      const memberNo = await nextMemberNo();
      const member = await Member.create({
        memberNo,
        name: m.name,
        fatherName: m.fatherName,
        mobile: m.mobile,
        email: m.email,
        mohalla: m.mohalla,
        address: m.address,
        joinDate,
        notes: m.notes,
        openingDue: m.openingDue,
        status: "active",
      });
      await logActivity({ actorId: actor.id, action: "member.created", entity: "Member", entityId: member._id, meta: { source: "import", memberNo, name: m.name } });
      created += 1;
    }
    const openingDue = valid.reduce((sum, m) => sum + m.openingDue, 0);
    await logActivity({ actorId: actor.id, action: "import.members", entity: "Member", meta: { created, skipped: skippedBadRows, openingDue } });
    return { created, skipped: skippedBadRows, amount: openingDue };
  }

  if (kind === "history") {
    const valid = rows.flatMap((r) => (r.data ? [r.data as HistoryChecked] : []));
    const result = await createRegisterPayments(valid, actor.id);
    await logActivity({ actorId: actor.id, action: "import.history", entity: "Income", meta: { ...result, skippedRows: skippedBadRows, note: REGISTER_NOTE } });
    return { created: result.created, skipped: skippedBadRows + result.skipped, amount: result.amount };
  }

  const valid = rows.flatMap((r) => (r.data ? [r.data as CaseImportRow] : []));
  const result = await createRegisterCases(valid, actor.id);
  await logActivity({ actorId: actor.id, action: "import.cases", entity: "AidCase", meta: { ...result, skippedRows: skippedBadRows } });
  return { created: result.created, skipped: skippedBadRows, amount: result.amount };
}

const EXAMPLES: Record<ImportKind, (string | number)[][]> = {
  members: [
    ["Muhammad Akram", "Ghulam Nabi", "0300-1234567", "Mohalla Arain", "Gali 3, Megowal", "2023-01-01", 1500, "", "Paid up to Dec in the register"],
    ["Bashir Ahmad", "Allah Ditta", "", "Mohalla Masjid Wala", "", "2024-06-01", 0, "", ""],
  ],
  history: [
    ["EP-001", "2025-11", 500, "2025-11-05"],
    ["EP-001", "2025-12", 500, ""],
  ],
  cases: [["Naseem Bibi", "funeral", "Muhammad Rafiq (beta)", "Mohalla Kumharan", "Kafan dafan aur khana", 25000, "2025-06-12", "no"]],
};

const HELP: Record<ImportKind, string[]> = {
  members: [
    "One row per member. Name, Father name, Mohalla and Join date are required.",
    "Dates: 2024-03-15 or 15/03/2024. Mobile: any common format (0300-1234567, +92 300 1234567).",
    "Opening due: what the member still owed in the register before the first app month (empty = 0).",
    "Ek row mein ek member. Naam, walid ka naam, mohalla aur shamil hone ki tareekh zaroori hain.",
  ],
  history: [
    "One row per month paid, from the paper register, BEFORE the first month kept in the app.",
    "Member no as in the app (EP-001). Month: 2025-11 or Nov 2025. Date paid is optional.",
    "These payments show in the member's ledger as 'Imported from register'. They do not change account balances.",
    "Register ke purane chande: har adaigi ki ek row. Yeh sirf record ke liye hain, kisi khate ki raqam nahi badalti.",
  ],
  cases: [
    "One row per old aid case that was already completed before the first app month.",
    "Category: wedding, funeral, medical, education, house_repair, ration or other (Roman Urdu like shadi, fotgi, ilaj also work).",
    "Show name to members: yes or no. Total paid and Date (when the case was completed) are required.",
    "Purane mukammal imdadi case. Yeh sirf record ke liye hain, kisi khate ki raqam nahi badalti.",
  ],
};

/** An empty template to fill in: headers, example rows and a help sheet. Same permission as the import. */
export async function buildImportTemplate(kind: ImportKind): Promise<{ filename: string; body: Uint8Array }> {
  await requirePermission(PERMISSION[kind]);
  const sheet = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS[kind].map((c) => c.header), ...EXAMPLES[kind]]);
  sheet["!cols"] = IMPORT_COLUMNS[kind].map((c) => ({ wch: Math.max(14, c.header.length + 4) }));
  const help = XLSX.utils.aoa_to_sheet(HELP[kind].map((line) => [line]));
  help["!cols"] = [{ wch: 110 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Template");
  XLSX.utils.book_append_sheet(book, help, "Help");
  const body = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { filename: `ehsas-${kind}-template.xlsx`, body: new Uint8Array(body) };
}
