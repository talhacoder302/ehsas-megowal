import "server-only";
import { Types } from "mongoose";
import { REGISTER_INCOME_SOURCE, type AccountType } from "@/lib/contributions";
import { dateKey, parseDateKey, type MonthKey } from "@/lib/dates";
import { AppError, type ServerErrorCode } from "@/lib/errors";
import { MEMBER_STATUSES, type MemberStatus } from "@/lib/member-status";
import { requirePermission } from "@/lib/permissions";
import { memberOpeningsSchema, openingBalancesSchema, setupDatesSchema } from "@/lib/validators";
import { Account, AidCase, ContributionBill, Income, Member, Settings } from "@/models";
import { accountBalance, movementsByAccount, NO_MOVEMENTS } from "./account-totals";
import { logActivity } from "./activity-log";
import { lockedThrough } from "./closing-core";
import { readSettings } from "./settings";
import { assertSetupOpen, firstMonthConflict } from "./setup-core";

export type SetupAccount = { id: string; name: string; type: AccountType; openingBalance: number; balance: number };

export type SetupMember = {
  id: string;
  memberNo: string;
  name: string;
  fatherName: string;
  status: MemberStatus;
  joinDate: string;
  /** What the member owed from the paper register (before anything was paid off it). */
  openingDue: number;
  /** Paid off the opening due in the app since. */
  openingDuePaid: number;
};

export type Reconciliation = {
  members: { total: number; byStatus: Record<MemberStatus, number> };
  openingDues: { original: number; paidSince: number; remaining: number; members: number };
  accounts: { name: string; type: AccountType; openingBalance: number; balance: number }[];
  openingTotal: number;
  balanceTotal: number;
  register: { payments: number; amount: number; members: number; from: MonthKey | null; to: MonthKey | null };
  registerCases: { count: number; amount: number };
};

export type SetupState = {
  programStartDate: string | null;
  firstMonth: MonthKey | null;
  completedAt: string | null;
  /** The first month is closed: the setup is read-only until the admin reopens it. */
  locked: boolean;
  lockedThrough: MonthKey | null;
  accounts: SetupAccount[];
  members: SetupMember[];
  reconciliation: Reconciliation;
};

async function openingPaidByMember(): Promise<Map<string, number>> {
  const rows = await Income.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { cancelled: false, openingDuePaid: { $gt: 0 } } },
    { $group: { _id: "$memberId", total: { $sum: "$openingDuePaid" } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.total]));
}

async function setupAccounts(): Promise<SetupAccount[]> {
  const [accounts, movements] = await Promise.all([
    Account.find().select("name type openingBalance").sort({ createdAt: 1 }).lean(),
    movementsByAccount(),
  ]);
  return accounts.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    type: a.type,
    openingBalance: a.openingBalance,
    balance: accountBalance({ openingBalance: a.openingBalance, ...(movements.get(a._id.toString()) ?? NO_MOVEMENTS) }),
  }));
}

async function setupMembers(): Promise<SetupMember[]> {
  const [members, paid] = await Promise.all([
    Member.find()
      .select("memberNo name fatherName status joinDate openingDue")
      .sort({ memberNo: 1 })
      .collation({ locale: "en", numericOrdering: true })
      .lean(),
    openingPaidByMember(),
  ]);
  return members.map((m) => {
    const openingDuePaid = paid.get(m._id.toString()) ?? 0;
    return {
      id: m._id.toString(),
      memberNo: m.memberNo,
      name: m.name,
      fatherName: m.fatherName,
      status: m.status,
      joinDate: dateKey(m.joinDate),
      openingDue: m.openingDue + openingDuePaid,
      openingDuePaid,
    };
  });
}

async function reconciliation(accounts: SetupAccount[], members: SetupMember[]): Promise<Reconciliation> {
  const [register, registerMonths, registerCases] = await Promise.all([
    Income.aggregate<{ _id: null; payments: number; amount: number; members: Types.ObjectId[] }>([
      { $match: { source: REGISTER_INCOME_SOURCE, cancelled: false } },
      { $group: { _id: null, payments: { $sum: 1 }, amount: { $sum: "$amount" }, members: { $addToSet: "$memberId" } } },
    ]),
    ContributionBill.aggregate<{ _id: null; from: MonthKey; to: MonthKey }>([
      { $match: { origin: "register", status: "paid" } },
      { $group: { _id: null, from: { $min: "$month" }, to: { $max: "$month" } } },
    ]),
    AidCase.aggregate<{ _id: null; count: number; amount: number }>([
      { $match: { importedFromRegister: true } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$registerPaidAmount" } } },
    ]),
  ]);
  const byStatus = Object.fromEntries(MEMBER_STATUSES.map((s) => [s, members.filter((m) => m.status === s).length])) as Record<MemberStatus, number>;
  const original = members.reduce((sum, m) => sum + m.openingDue, 0);
  const paidSince = members.reduce((sum, m) => sum + m.openingDuePaid, 0);
  return {
    members: { total: members.length, byStatus },
    openingDues: { original, paidSince, remaining: original - paidSince, members: members.filter((m) => m.openingDue > 0).length },
    accounts: accounts.map(({ name, type, openingBalance, balance }) => ({ name, type, openingBalance, balance })),
    openingTotal: accounts.reduce((sum, a) => sum + a.openingBalance, 0),
    balanceTotal: accounts.reduce((sum, a) => sum + a.balance, 0),
    register: {
      payments: register[0]?.payments ?? 0,
      amount: register[0]?.amount ?? 0,
      members: register[0]?.members.length ?? 0,
      from: registerMonths[0]?.from ?? null,
      to: registerMonths[0]?.to ?? null,
    },
    registerCases: { count: registerCases[0]?.count ?? 0, amount: registerCases[0]?.amount ?? 0 },
  };
}

/** Everything the opening setup screens show. Heads and admin. */
export async function getSetupState(): Promise<SetupState> {
  await requirePermission("setup.manage");
  const [settings, locked, accounts, members] = await Promise.all([readSettings(), lockedThrough(), setupAccounts(), setupMembers()]);
  return {
    ...settings.setup,
    locked: locked !== null,
    lockedThrough: locked,
    accounts,
    members,
    reconciliation: await reconciliation(accounts, members),
  };
}

/** Step 1: when the fund started and the first month kept in the app. */
export async function saveSetupDates(input: unknown): Promise<void> {
  const actor = await requirePermission("setup.manage");
  const values = setupDatesSchema.parse(input);
  await assertSetupOpen();
  const conflict = await firstMonthConflict(values.firstMonth);
  if (conflict) throw new AppError(conflict);

  const before = (await readSettings()).setup;
  const start = parseDateKey(values.programStartDate);
  if (!start) throw new AppError("invalidInput");
  await Settings.updateOne({ key: "main" }, { $set: { programStartDate: start, firstMonth: values.firstMonth } }, { upsert: true, runValidators: true });
  await logActivity({
    actorId: actor.id,
    action: "setup.dates_saved",
    entity: "Settings",
    meta: {
      programStartDate: { from: before.programStartDate ? dateKey(before.programStartDate) : null, to: values.programStartDate },
      firstMonth: { from: before.firstMonth, to: values.firstMonth },
    },
  });
}

/**
 * Step 2: each account's balance at the start of the first month, from the
 * register. Refused if it would leave an account below zero after what has
 * already been spent from it.
 */
export async function saveOpeningBalances(input: unknown): Promise<number> {
  const actor = await requirePermission("setup.manage");
  const { accounts } = openingBalancesSchema.parse(input);
  await assertSetupOpen();
  const current = new Map((await setupAccounts()).map((a) => [a.id, a]));

  const changes = accounts.filter((a) => current.has(a.accountId) && current.get(a.accountId)?.openingBalance !== a.openingBalance);
  if (accounts.some((a) => !current.has(a.accountId))) throw new AppError("accountNotFound");
  for (const change of changes) {
    const account = current.get(change.accountId)!;
    if (account.balance - account.openingBalance + change.openingBalance < 0) throw new AppError("insufficientBalance");
  }
  for (const change of changes) {
    const account = current.get(change.accountId)!;
    await Account.updateOne({ _id: change.accountId }, { $set: { openingBalance: change.openingBalance } }, { runValidators: true });
    await logActivity({
      actorId: actor.id,
      action: "account.opening_balance_changed",
      entity: "Account",
      entityId: change.accountId,
      meta: { name: account.name, from: account.openingBalance, to: change.openingBalance },
    });
  }
  return changes.length;
}

export type MemberOpeningError = { memberId: string; code: ServerErrorCode };

/**
 * Step 3: join date and opening due per member. The opening due typed is what
 * the member owed before the first month; anything already paid off it in the
 * app is kept. Rows that cannot change come back with a reason; the others are saved.
 */
export async function saveMemberOpenings(input: unknown): Promise<{ saved: number; errors: MemberOpeningError[] }> {
  const actor = await requirePermission("setup.manage");
  const { members } = memberOpeningsSchema.parse(input);
  await assertSetupOpen();
  const current = new Map((await setupMembers()).map((m) => [m.id, m]));
  const errors: MemberOpeningError[] = [];
  let saved = 0;

  for (const row of members) {
    const member = current.get(row.memberId);
    if (!member) {
      errors.push({ memberId: row.memberId, code: "memberNotFound" });
      continue;
    }
    const changes: Record<string, { from: string | number; to: string | number }> = {};
    if (row.openingDue !== member.openingDue) changes.openingDue = { from: member.openingDue, to: row.openingDue };
    if (row.joinDate !== member.joinDate) changes.joinDate = { from: member.joinDate, to: row.joinDate };
    if (Object.keys(changes).length === 0) continue;

    if (row.openingDue < member.openingDuePaid) {
      errors.push({ memberId: row.memberId, code: "openingDueBelowPaid" });
      continue;
    }
    if (changes.joinDate) {
      const doc = await Member.findById(row.memberId).select("statusHistory").lean();
      const firstChange = doc?.statusHistory?.[0];
      if (firstChange && row.joinDate > dateKey(firstChange.date)) {
        errors.push({ memberId: row.memberId, code: "statusBeforeJoin" });
        continue;
      }
      if (await ContributionBill.exists({ memberId: row.memberId, month: { $lt: row.joinDate.slice(0, 7) } })) {
        errors.push({ memberId: row.memberId, code: "billsBeforeJoin" });
        continue;
      }
    }

    await Member.updateOne(
      { _id: row.memberId },
      { $set: { openingDue: row.openingDue - member.openingDuePaid, joinDate: parseDateKey(row.joinDate) } },
      { runValidators: true },
    );
    await logActivity({ actorId: actor.id, action: "member.updated", entity: "Member", entityId: row.memberId, meta: { source: "setup", changes } });
    saved += 1;
  }
  return { saved, errors };
}

/** Marks the setup done (it stays editable until the first month is closed). Needs the first month. */
export async function completeSetup(): Promise<void> {
  const actor = await requirePermission("setup.manage");
  await assertSetupOpen();
  const { setup } = await readSettings();
  if (!setup.firstMonth) throw new AppError("setFirstMonthFirst");
  await Settings.updateOne({ key: "main" }, { $set: { setupCompletedAt: new Date(), setupCompletedBy: new Types.ObjectId(actor.id) } });
  await logActivity({ actorId: actor.id, action: "setup.completed", entity: "Settings", meta: { firstMonth: setup.firstMonth } });
}

/** Whether the dashboard should invite heads to the opening setup. */
export async function setupNeeded(): Promise<boolean> {
  await requirePermission("setup.manage");
  const [{ setup }, locked] = await Promise.all([readSettings(), lockedThrough()]);
  return !setup.completedAt && !locked;
}
