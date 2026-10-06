import "server-only";
import { Types } from "mongoose";
import type { Locale } from "@/i18n/config";
import type { CaseCategory, CaseStatus } from "@/lib/cases";
import { amountThrough, type AccountType } from "@/lib/contributions";
import { dateKey, parseDateKey, todayKey, type MonthKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import type { MemberStatus } from "@/lib/member-status";
import type { Role } from "@/lib/roles";
import {
  Account,
  AidCase,
  ContributionBill,
  ContributionRate,
  DEFAULT_MEMBER_NO_PREFIX,
  Disbursement,
  Expense,
  Income,
  Member,
  Settings,
  Transfer,
  User,
  type SettingsDoc,
} from "@/models";
import { logActivity } from "./activity-log";
import { applyPayment, cancelIncome, createBillsForMonth, memberPayables } from "./contributions-core";
import { generateTempPassword, hashPassword } from "./passwords";
import { nextCaseNo, nextMemberNo } from "./sequence";

// System-level setup used only by scripts (seed, migrations). Never call these
// from Server Actions or route handlers; they do not check a session.

/** Creates collections and indexes for all registered models. */
export async function syncModelIndexes(): Promise<string[]> {
  const conn = await connectDB();
  const names: string[] = [];
  for (const name of conn.modelNames()) {
    const m = conn.model(name);
    await m.createCollection();
    await m.syncIndexes();
    names.push(name);
  }
  return names;
}

/** Inserts the settings singleton if it does not exist yet. Existing values are kept. */
export async function ensureDefaultSettings(): Promise<SettingsDoc> {
  await connectDB();
  const doc = await Settings.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  if (!doc) throw new Error("Could not create settings");
  // Fields added after the document was first made get their defaults.
  if (!doc.memberNoPrefix) {
    await Settings.updateOne({ key: "main" }, { $set: { memberNoPrefix: DEFAULT_MEMBER_NO_PREFIX } });
    doc.memberNoPrefix = DEFAULT_MEMBER_NO_PREFIX;
  }
  return doc;
}

export type SeedUser = {
  name: string;
  mobile: string;
  role: Role;
  language: Locale;
  memberId?: Types.ObjectId | null;
  /** Password to set. A random temporary one is made when left out. */
  password?: string;
  /** Force a password change at first login. */
  mustChangePassword: boolean;
};

/**
 * Creates the user if no user has this mobile yet. Existing users are never
 * changed, so re-running the seed does not reset anyone's password.
 * Returns the password that was set, or null if the user already existed.
 */
export async function ensureUser(seed: SeedUser): Promise<{ created: boolean; password: string | null }> {
  await connectDB();
  if (await User.exists({ mobile: seed.mobile })) return { created: false, password: null };

  const password = seed.password ?? generateTempPassword();
  const user = await User.create({
    name: seed.name,
    mobile: seed.mobile,
    role: seed.role,
    language: seed.language,
    memberId: seed.memberId ?? null,
    passwordHash: await hashPassword(password),
    mustChangePassword: seed.mustChangePassword,
    status: "active",
  });
  await logActivity({
    actorId: null,
    action: "user.created",
    entity: "User",
    entityId: user._id,
    meta: { source: "seed", role: seed.role },
  });
  return { created: true, password };
}

export type SeedMember = {
  name: string;
  fatherName: string;
  /** Empty for members without a phone. */
  mobile: string;
  mohalla: string;
  joinDate: Date;
  openingDue?: number;
  notes?: string;
  /** A status change to record after creating the member (left, deceased, exempt). */
  statusChange?: { status: MemberStatus; date: Date; reason: string };
};

/**
 * Adds members that are not there yet (matched on name + father name), giving
 * each the next member number. Returns every member in the list, in order.
 */
export async function ensureMembers(seeds: SeedMember[]): Promise<{ id: Types.ObjectId; memberNo: string; created: boolean }[]> {
  await connectDB();
  const out: { id: Types.ObjectId; memberNo: string; created: boolean }[] = [];
  for (const { statusChange, ...seed } of seeds) {
    const existing = await Member.findOne({ name: seed.name, fatherName: seed.fatherName }).select("memberNo").lean();
    if (existing) {
      out.push({ id: existing._id, memberNo: existing.memberNo, created: false });
      continue;
    }
    const memberNo = await nextMemberNo();
    const member = await Member.create({
      ...seed,
      memberNo,
      address: `${seed.mohalla}, Megowal`,
      status: statusChange?.status ?? "active",
      statusChangedAt: statusChange?.date ?? null,
      statusReason: statusChange?.reason ?? "",
      statusHistory: statusChange ? [{ ...statusChange, changedBy: null, changedAt: statusChange.date }] : [],
    });
    await logActivity({
      actorId: null,
      action: "member.created",
      entity: "Member",
      entityId: member._id,
      meta: { source: "seed", memberNo, name: seed.name },
    });
    if (statusChange) {
      await logActivity({
        actorId: null,
        action: "member.status_changed",
        entity: "Member",
        entityId: member._id,
        meta: { source: "seed", from: "active", to: statusChange.status, date: dateKey(statusChange.date), reason: statusChange.reason },
      });
    }
    out.push({ id: member._id, memberNo, created: true });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Contributions (Module 3)
// ---------------------------------------------------------------------------

export async function userIdByMobile(mobile: string): Promise<string | null> {
  await connectDB();
  const user = await User.findOne({ mobile }).select("_id").lean();
  return user ? user._id.toString() : null;
}

/** Adds rates whose month has no rate yet. Existing rates are kept as they are. */
export async function ensureRates(rates: { amount: number; effectiveFrom: MonthKey; note: string }[]): Promise<number> {
  await connectDB();
  let added = 0;
  for (const rate of rates) {
    const result = await ContributionRate.updateOne(
      { effectiveFrom: rate.effectiveFrom },
      { $setOnInsert: { ...rate, createdBy: null } },
      { upsert: true },
    );
    added += result.upsertedCount;
  }
  return added;
}

/** Creates the account if no account has this name. Returns its id. */
export async function ensureAccount(input: {
  name: string;
  type: AccountType;
  holderUserId: string | null;
}): Promise<{ id: string; created: boolean }> {
  await connectDB();
  const existing = await Account.findOne({ name: input.name }).collation({ locale: "en", strength: 2 }).select("_id").lean();
  if (existing) return { id: existing._id.toString(), created: false };
  const account = await Account.create({
    name: input.name,
    type: input.type,
    holderUserId: input.holderUserId ? new Types.ObjectId(input.holderUserId) : null,
    openingBalance: 0,
  });
  await logActivity({
    actorId: null,
    action: "account.created",
    entity: "Account",
    entityId: account._id,
    meta: { source: "seed", name: input.name },
  });
  return { id: account._id.toString(), created: true };
}

export type DemoContributionsResult = { skipped: boolean; bills: number; payments: number; cancelled: number; waived: number };

const DUPLICATE_REASON = "Entered twice by mistake.";
const WAIVE_REASON = "Family had a medical emergency this month; heads agreed to waive.";

/**
 * Demo history: bills for `months` and a realistic mix of payments (paid up,
 * part paid, paid in advance, not paid), one cancelled payment and one waived
 * bill. Runs only once: skipped when any payment exists.
 */
export async function seedDemoContributions(input: {
  /** Oldest first: [two months ago, last month, this month]. */
  months: [MonthKey, MonthKey, MonthKey];
  accountId: string;
  /** [first head, second head] user ids. */
  heads: [string, string];
}): Promise<DemoContributionsResult> {
  await connectDB();
  if (await Income.exists({})) return { skipped: true, bills: 0, payments: 0, cancelled: 0, waived: 0 };

  let bills = 0;
  for (const month of input.months) bills += (await createBillsForMonth(month, null, "seed")).created;

  const billed = await ContributionBill.distinct("memberId", { month: { $in: input.months } });
  const members = await Member.find({ _id: { $in: billed } })
    .select("memberNo")
    .sort({ memberNo: 1 })
    .collation({ locale: "en", numericOrdering: true })
    .lean();

  const today = todayKey();
  /** A day in the month, but never after today. */
  const dayIn = (month: MonthKey, dayOfMonth: number) => {
    const key = `${month}-${String(dayOfMonth).padStart(2, "0")}`;
    return parseDateKey(key < today ? key : today) ?? new Date();
  };
  const [first, second, current] = input.months;

  async function pay(memberId: string, amount: number, date: Date, receivedBy: string) {
    const payment = await applyPayment({ memberId, amount, accountId: input.accountId, method: "cash", date, note: "", receivedBy });
    await logActivity({
      actorId: receivedBy,
      action: "payment.received",
      entity: "Income",
      entityId: payment.id,
      meta: {
        source: "seed",
        memberId,
        receiptNumber: payment.receiptNumber,
        amount,
        months: payment.monthsCovered,
        openingDuePaid: payment.openingDuePaid,
      },
    });
    return payment;
  }

  let payments = 0;
  const notPaid: string[] = [];
  for (const [i, member] of members.entries()) {
    const id = member._id.toString();
    const pattern = i % 6;
    // 0: has not paid; 1: paid the oldest month; 2-3: paid up to last month;
    // 4: paid up to this month; 5: this month plus two months in advance.
    const target = [null, first, second, second, current, current][pattern];
    if (!target) {
      notPaid.push(id);
      continue;
    }
    const payables = await memberPayables(id);
    if (!payables) continue;
    const index = payables.items.findIndex((item) => item.month === target);
    // One member pays a little extra, which leaves the next month part paid.
    const amount = amountThrough(payables.items, pattern === 5 ? index + 2 : index) + (i === 7 ? 150 : 0);
    if (index < 0 || amount <= 0) continue;
    await pay(id, amount, dayIn(target, 8 + (i % 12)), input.heads[i % 2]);
    payments += 1;
  }

  // A payment entered twice by mistake, cancelled by the other head.
  let cancelled = 0;
  const twiceFor = members.find((_, i) => i % 6 === 2)?._id.toString();
  const twicePayables = twiceFor ? await memberPayables(twiceFor) : null;
  if (twiceFor && twicePayables) {
    const amount = amountThrough(twicePayables.items, twicePayables.items.findIndex((item) => item.month === current));
    if (amount > 0) {
      const duplicate = await pay(twiceFor, amount, dayIn(current, 3), input.heads[0]);
      await cancelIncome(duplicate.id, input.heads[1], DUPLICATE_REASON);
      await logActivity({
        actorId: input.heads[1],
        action: "payment.cancelled",
        entity: "Income",
        entityId: duplicate.id,
        meta: { source: "seed", memberId: twiceFor, receiptNumber: duplicate.receiptNumber, amount, reason: DUPLICATE_REASON },
      });
      payments += 1;
      cancelled = 1;
    }
  }

  // One bill waived for a family going through a hard month.
  let waived = 0;
  if (notPaid[0]) {
    const bill = await ContributionBill.findOneAndUpdate(
      { memberId: new Types.ObjectId(notPaid[0]), month: first, status: "unpaid", paidAmount: 0 },
      {
        $set: {
          status: "waived",
          waivedReason: WAIVE_REASON,
          waivedBy: new Types.ObjectId(input.heads[0]),
          waivedAt: new Date(),
        },
      },
    ).lean();
    if (bill) {
      await logActivity({
        actorId: input.heads[0],
        action: "bill.waived",
        entity: "ContributionBill",
        entityId: bill._id,
        meta: { source: "seed", memberId: notPaid[0], month: first, amount: bill.amount, reason: WAIVE_REASON },
      });
      waived = 1;
    }
  }

  return { skipped: false, bills, payments, cancelled, waived };
}

// ---------------------------------------------------------------------------
// Money going out (Module 5)
// ---------------------------------------------------------------------------

export type DemoPayoutsResult = { skipped: boolean; disbursements: number; pending: number; expenses: number; transfers: number };

const DEMO_OPENING_BALANCE = 185000;
const DEMO_APPROVAL_LIMIT = 25000;

/**
 * Demo payouts on the seeded cases, a few expenses and a cash-to-bank
 * transfer. Runs only once (skipped when any disbursement or expense exists).
 * Gives the cash account its paper-register opening balance first so no
 * balance goes below zero, and turns on second-head approval above Rs. 25,000
 * if the settings are still at their defaults.
 */
export async function seedDemoPayouts(input: { cashAccountId: string; heads: [string, string] }): Promise<DemoPayoutsResult> {
  await connectDB();
  if ((await Disbursement.exists({})) || (await Expense.exists({}))) {
    return { skipped: true, disbursements: 0, pending: 0, expenses: 0, transfers: 0 };
  }
  const [head1, head2] = input.heads.map((id) => new Types.ObjectId(id));
  const cash = new Types.ObjectId(input.cashAccountId);
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await Account.updateOne({ _id: cash, openingBalance: 0 }, { $set: { openingBalance: DEMO_OPENING_BALANCE } });
  await Settings.updateOne(
    { key: "main", secondHeadApprovalEnabled: false, secondHeadApprovalLimit: 0 },
    { $set: { secondHeadApprovalEnabled: true, secondHeadApprovalLimit: DEMO_APPROVAL_LIMIT } },
  );
  const bank = await ensureAccount({ name: "HBL Megowal", type: "bank", holderUserId: null });

  const caseIds = new Map(
    (await AidCase.find({ caseNo: { $in: ["C-0001", "C-0002", "C-0005", "C-0008"] } }).select("caseNo").lean()).map((c) => [c.caseNo, c._id]),
  );
  type Payout = { caseNo: string; amount: number; daysAgo: number; receivedByName: string; note: string; by: Types.ObjectId; status: "not_required" | "approved" | "pending" };
  const payouts: Payout[] = [
    { caseNo: "C-0001", amount: 20000, daysAgo: 2, receivedByName: "Muhammad Akram (walid)", note: "Jahez ke bartan aur bistar", by: head1, status: "not_required" },
    { caseNo: "C-0001", amount: 30000, daysAgo: 0, receivedByName: "Muhammad Akram (walid)", note: "Baraat ke khane ki advance", by: head1, status: "pending" },
    { caseNo: "C-0002", amount: 15000, daysAgo: 18, receivedByName: "Ghulam Qadir (walid)", note: "Pehli qist kapron ke liye", by: head2, status: "not_required" },
    { caseNo: "C-0005", amount: 30000, daysAgo: 45, receivedByName: "Bashiran Bibi", note: "Kafan dafan aur teen din ka khana", by: head1, status: "approved" },
    { caseNo: "C-0008", amount: 5000, daysAgo: 21, receivedByName: "Haji Rasheed Karyana Store", note: "Pehle mahine ka rashan", by: head2, status: "not_required" },
    { caseNo: "C-0008", amount: 5000, daysAgo: 14, receivedByName: "Haji Rasheed Karyana Store", note: "Doosre mahine ka rashan", by: head2, status: "not_required" },
    { caseNo: "C-0008", amount: 5000, daysAgo: 8, receivedByName: "Haji Rasheed Karyana Store", note: "Teesre mahine ka rashan", by: head2, status: "not_required" },
  ];

  let disbursements = 0;
  let pending = 0;
  for (const p of payouts) {
    const caseId = caseIds.get(p.caseNo);
    if (!caseId) continue;
    const approver = p.by.equals(head1) ? head2 : head1;
    const d = await Disbursement.create({
      caseId,
      amount: p.amount,
      date: daysAgo(p.daysAgo),
      accountId: cash,
      paidBy: p.by,
      receivedByName: p.receivedByName,
      note: p.note,
      approvalStatus: p.status,
      approvedBy: p.status === "approved" ? approver : null,
      approvedAt: p.status === "approved" ? daysAgo(p.daysAgo) : null,
    });
    await logActivity({
      actorId: p.by.toString(),
      action: "disbursement.created",
      entity: "Disbursement",
      entityId: d._id,
      meta: { source: "seed", caseNo: p.caseNo, amount: p.amount, approvalStatus: p.status },
    });
    disbursements += 1;
    if (p.status === "pending") pending += 1;
  }

  const expenses = [
    { category: "stationery", description: "Register aur pen", amount: 450, daysAgo: 30, by: head1 },
    { category: "printing", description: "Raseed bookein chhapwain", amount: 1200, daysAgo: 25, by: head2 },
    { category: "transport", description: "Hospital tak rickshaw ka kiraya (C-0003 ki report)", amount: 600, daysAgo: 12, by: head1 },
  ] as const;
  for (const e of expenses) {
    const doc = await Expense.create({ ...e, date: daysAgo(e.daysAgo), accountId: cash, createdBy: e.by });
    await logActivity({
      actorId: e.by.toString(),
      action: "expense.created",
      entity: "Expense",
      entityId: doc._id,
      meta: { source: "seed", category: e.category, amount: e.amount },
    });
  }

  const transfer = await Transfer.create({
    fromAccountId: cash,
    toAccountId: new Types.ObjectId(bank.id),
    amount: 10000,
    date: daysAgo(5),
    note: "Naqdi HBL Megowal mein jama karwai",
    createdBy: head1,
  });
  await logActivity({
    actorId: head1.toString(),
    action: "transfer.created",
    entity: "Transfer",
    entityId: transfer._id,
    meta: { source: "seed", amount: 10000 },
  });

  return { skipped: false, disbursements, pending, expenses: expenses.length, transfers: 1 };
}

// ---------------------------------------------------------------------------
// Aid cases (Module 4)
// ---------------------------------------------------------------------------

type SeedCaseStep = { status: CaseStatus; daysAgo: number; reason: string; approvedAmount?: number };

export type SeedCase = {
  category: CaseCategory;
  beneficiaryName: string;
  guardianName: string;
  mohalla: string;
  contactMobile: string;
  recommendedBy: string;
  description: string;
  estimatedAmount: number;
  /** Days from today; negative is in the past. */
  expectedInDays: number | null;
  showNameToMembers: boolean;
  /** Oldest first; the first step is the case being opened. */
  steps: SeedCaseStep[];
  notes?: { daysAgo: number; text: string }[];
};

/**
 * Demo aid cases with a realistic history. Runs only once: skipped when any
 * case exists. Dates are relative to today so the highlights stay meaningful.
 */
export async function seedDemoCases(cases: SeedCase[], heads: [string, string]): Promise<{ skipped: boolean; created: number }> {
  await connectDB();
  if (await AidCase.exists({})) return { skipped: true, created: 0 };

  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let created = 0;
  for (const [i, seed] of cases.entries()) {
    const caseNo = await nextCaseNo();
    const history = seed.steps.map((step, j) => ({
      status: step.status,
      reason: step.reason,
      approvedAmount: step.approvedAmount ?? null,
      changedBy: new Types.ObjectId(heads[(i + j) % 2]),
      changedAt: daysAgo(step.daysAgo),
    }));
    const notes = (seed.notes ?? []).map((n) => ({ text: n.text, createdBy: new Types.ObjectId(heads[0]), createdAt: daysAgo(n.daysAgo) }));
    const approved = [...seed.steps].reverse().find((s) => s.approvedAmount !== undefined)?.approvedAmount ?? null;
    const lastUpdateAt = new Date(Math.max(...history.map((h) => h.changedAt.getTime()), ...notes.map((n) => n.createdAt.getTime())));

    const doc = await AidCase.create({
      caseNo,
      category: seed.category,
      beneficiaryName: seed.beneficiaryName,
      guardianName: seed.guardianName,
      mohalla: seed.mohalla,
      contactMobile: seed.contactMobile,
      recommendedBy: seed.recommendedBy,
      description: seed.description,
      estimatedAmount: seed.estimatedAmount,
      approvedAmount: approved,
      expectedDate: seed.expectedInDays === null ? null : daysAgo(-seed.expectedInDays),
      status: seed.steps[seed.steps.length - 1].status,
      statusHistory: history,
      notes,
      showNameToMembers: seed.showNameToMembers,
      lastUpdateAt,
      createdBy: new Types.ObjectId(heads[i % 2]),
    });
    // Mongoose keeps createdAt immutable; the opened date should match the history.
    await AidCase.collection.updateOne({ _id: doc._id }, { $set: { createdAt: history[0].changedAt } });
    await logActivity({
      actorId: heads[i % 2],
      action: "case.created",
      entity: "AidCase",
      entityId: doc._id,
      meta: { source: "seed", caseNo, category: seed.category, estimatedAmount: seed.estimatedAmount },
    });
    created += 1;
  }
  return { skipped: false, created };
}
