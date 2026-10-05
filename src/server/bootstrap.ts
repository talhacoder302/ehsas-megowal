import "server-only";
import { Types } from "mongoose";
import type { Locale } from "@/i18n/config";
import { amountThrough, type AccountType } from "@/lib/contributions";
import { dateKey, parseDateKey, todayKey, type MonthKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import type { MemberStatus } from "@/lib/member-status";
import type { Role } from "@/lib/roles";
import {
  Account,
  ContributionBill,
  ContributionRate,
  DEFAULT_MEMBER_NO_PREFIX,
  Income,
  Member,
  Settings,
  User,
  type SettingsDoc,
} from "@/models";
import { logActivity } from "./activity-log";
import { applyPayment, cancelIncome, createBillsForMonth, memberPayables } from "./contributions-core";
import { generateTempPassword, hashPassword } from "./passwords";
import { nextMemberNo } from "./sequence";

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
