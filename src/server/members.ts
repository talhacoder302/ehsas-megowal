import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { currentMonth, dateKey, parseDateKey, type DateKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import type { MemberStatus } from "@/lib/member-status";
import { requirePermission, requireRole } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import {
  memberFormSchema,
  memberStatusChangeSchema,
  type MemberFormValues,
} from "@/lib/validators";
import { ActivityLog, Member, User, type MemberDoc, type UserStatus } from "@/models";
import { logActivity } from "./activity-log";
import { billDuesByMember } from "./contributions-core";
import { nextMemberNo } from "./sequence";

export type MemberListItem = {
  id: string;
  memberNo: string;
  name: string;
  fatherName: string;
  mobile: string;
  mohalla: string;
  /** ISO instant; show with formatDate or dateKey. */
  joinDate: string;
  status: MemberStatus;
  statusChangedAt: string | null;
  hasLogin: boolean;
  /** Owed now: opening due plus unpaid bills up to the current month. */
  pendingAmount: number | null;
};

export type MemberStatusChangeItem = {
  status: MemberStatus;
  reason: string;
  date: string;
  changedByName: string | null;
  changedAt: string;
};

export type MemberLogin = {
  userId: string;
  mobile: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export type MemberDetail = MemberListItem & {
  address: string;
  notes: string;
  statusReason: string;
  openingDue: number;
  createdAt: string;
  /** Newest first. */
  statusHistory: MemberStatusChangeItem[];
  login: MemberLogin | null;
};

export type MemberActivityItem = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  /** Field edits for "*.updated" entries. */
  changes: { field: string; from: string; to: string }[];
  /** For "member.status_changed". */
  statusChange: { from: string; to: string; date: string; reason: string } | null;
  /** For payments and waived bills. */
  money: { receiptNumber: string | null; amount: number | null; months: string[]; reason: string | null } | null;
};

export type MemberLinkOption = {
  id: string;
  memberNo: string;
  name: string;
  fatherName: string;
  /** The user already linked to this member, if any. */
  linkedUserId: string | null;
};

type LeanMember = MemberDoc & { createdAt?: Date };

// "EP-2" before "EP-10".
const MEMBER_NO_ORDER = { locale: "en", numericOrdering: true } as const;
// "muhammad ali" matches "Muhammad Ali".
const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;

const LIST_FIELDS = "memberNo name fatherName mobile mohalla joinDate status statusChangedAt openingDue";

function toListItem(m: LeanMember, linkedMemberIds: Set<string>, billDues: Map<string, { due: number }>): MemberListItem {
  const id = m._id.toString();
  return {
    id,
    memberNo: m.memberNo,
    name: m.name,
    fatherName: m.fatherName,
    mobile: m.mobile,
    mohalla: m.mohalla,
    joinDate: m.joinDate.toISOString(),
    status: m.status,
    statusChangedAt: m.statusChangedAt ? m.statusChangedAt.toISOString() : null,
    hasLogin: linkedMemberIds.has(id),
    pendingAmount: m.openingDue + (billDues.get(id)?.due ?? 0),
  };
}

async function linkedMemberIdSet(): Promise<Set<string>> {
  const users = await User.find({ memberId: { $ne: null } }).select("memberId").lean();
  return new Set(users.map((u) => u.memberId?.toString() ?? ""));
}

function toDate(key: DateKey): Date {
  const date = parseDateKey(key);
  if (!date) throw new AppError("invalidInput");
  return date;
}

async function findMemberOrThrow(memberId: string): Promise<LeanMember> {
  if (!isValidObjectId(memberId)) throw new AppError("notFound");
  const member = await Member.findById(memberId).lean<LeanMember>();
  if (!member) throw new AppError("notFound");
  return member;
}

async function assertNotDuplicate(values: Pick<MemberFormValues, "name" | "fatherName">, exceptId?: string) {
  const existing = await Member.findOne({ name: values.name, fatherName: values.fatherName })
    .collation(CASE_INSENSITIVE)
    .select("_id")
    .lean();
  if (existing && existing._id.toString() !== exceptId) throw new AppError("memberDuplicate");
}

async function userNames(ids: (Types.ObjectId | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

// ---------------------------------------------------------------------------
// Reading (heads and admin)
// ---------------------------------------------------------------------------

export async function listMembers(): Promise<MemberListItem[]> {
  await requirePermission("members.read");
  const [members, linked] = await Promise.all([
    Member.find().select(LIST_FIELDS).sort({ memberNo: 1 }).collation(MEMBER_NO_ORDER).lean<LeanMember[]>(),
    linkedMemberIdSet(),
  ]);
  const dues = await billDuesByMember(currentMonth());
  return members.map((m) => toListItem(m, linked, dues));
}

/** null when the id is malformed or no member has it. */
export async function getMemberDetail(memberId: string): Promise<MemberDetail | null> {
  await requirePermission("members.read");
  if (!isValidObjectId(memberId)) return null;

  const member = await Member.findById(memberId).lean<LeanMember>();
  if (!member) return null;

  const user = await User.findOne({ memberId: member._id })
    .select("mobile role status mustChangePassword lastLoginAt")
    .lean();
  const history = member.statusHistory ?? [];
  const names = await userNames(history.map((h) => h.changedBy));

  return {
    ...toListItem(member, new Set(user ? [member._id.toString()] : []), await billDuesByMember(currentMonth(), member._id)),
    address: member.address,
    notes: member.notes,
    statusReason: member.statusReason,
    openingDue: member.openingDue,
    createdAt: (member.createdAt ?? member._id.getTimestamp()).toISOString(),
    statusHistory: history
      .map((h) => ({
        status: h.status,
        reason: h.reason,
        date: h.date.toISOString(),
        changedByName: h.changedBy ? (names.get(h.changedBy.toString()) ?? null) : null,
        changedAt: h.changedAt.toISOString(),
      }))
      .reverse(),
    login: user
      ? {
          userId: user._id.toString(),
          mobile: user.mobile,
          role: user.role,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        }
      : null,
  };
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

const MONEY_ACTIONS = new Set(["payment.received", "payment.cancelled", "bill.waived"]);

/** Changes to this member and to their login, newest first. */
export async function listMemberActivity(memberId: string): Promise<MemberActivityItem[]> {
  await requirePermission("members.read");
  if (!isValidObjectId(memberId)) return [];

  const id = new Types.ObjectId(memberId);
  const login = await User.findOne({ memberId: id }).select("_id").lean();
  const filters: Record<string, unknown>[] = [
    { entity: "Member", entityId: id },
    { "meta.memberId": memberId },
  ];
  if (login) filters.push({ entity: "User", entityId: login._id });

  const rows = await ActivityLog.find({ $or: filters }).sort({ createdAt: -1 }).limit(100).lean();
  const names = await userNames(rows.map((r) => r.actorId));

  return rows.map((row) => {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const rawChanges = (meta.changes ?? {}) as Record<string, { from?: unknown; to?: unknown }>;
    return {
      id: row._id.toString(),
      action: row.action,
      actorName: row.actorId ? (names.get(row.actorId.toString()) ?? null) : null,
      createdAt: (row.createdAt ?? row._id.getTimestamp()).toISOString(),
      changes: Object.entries(rawChanges).map(([field, c]) => ({ field, from: asText(c?.from), to: asText(c?.to) })),
      statusChange:
        row.action === "member.status_changed"
          ? { from: asText(meta.from), to: asText(meta.to), date: asText(meta.date), reason: asText(meta.reason) }
          : null,
      money: MONEY_ACTIONS.has(row.action)
        ? {
            receiptNumber: typeof meta.receiptNumber === "string" ? meta.receiptNumber : null,
            amount: typeof meta.amount === "number" ? meta.amount : null,
            months: Array.isArray(meta.months)
              ? meta.months.filter((m): m is string => typeof m === "string")
              : typeof meta.month === "string"
                ? [meta.month]
                : [],
            reason: typeof meta.reason === "string" ? meta.reason : null,
          }
        : null,
    };
  });
}

/** Mohalla names already in use, for suggestions in the member form. */
export async function listMohallas(): Promise<string[]> {
  await requirePermission("members.read");
  const values: string[] = await Member.distinct("mohalla");
  return values.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Members to choose from when linking a login to a member record. Admin only. */
export async function listMemberLinkOptions(): Promise<MemberLinkOption[]> {
  await requireRole("admin");

  const [members, links] = await Promise.all([
    Member.find({ status: { $ne: "deceased" } })
      .select("memberNo name fatherName")
      .sort({ memberNo: 1 })
      .collation(MEMBER_NO_ORDER)
      .lean(),
    User.find({ memberId: { $ne: null } }).select("memberId").lean(),
  ]);

  const linked = new Map(links.map((u) => [u.memberId?.toString(), u._id.toString()]));

  return members.map((m) => ({
    id: m._id.toString(),
    memberNo: m.memberNo,
    name: m.name,
    fatherName: m.fatherName,
    linkedUserId: linked.get(m._id.toString()) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Changes (heads and admin)
// ---------------------------------------------------------------------------

export async function createMember(input: unknown): Promise<{ id: string; memberNo: string }> {
  const actor = await requirePermission("members.manage");
  const values = memberFormSchema.parse(input);
  await assertNotDuplicate(values);

  const memberNo = await nextMemberNo();
  const member = await Member.create({
    memberNo,
    name: values.name,
    fatherName: values.fatherName,
    mobile: values.mobile,
    mohalla: values.mohalla,
    address: values.address,
    joinDate: toDate(values.joinDate),
    notes: values.notes,
    status: "active",
  });

  await logActivity({
    actorId: actor.id,
    action: "member.created",
    entity: "Member",
    entityId: member._id,
    meta: { memberNo, name: values.name },
  });
  return { id: member._id.toString(), memberNo };
}

export async function updateMember(memberId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("members.manage");
  const member = await findMemberOrThrow(memberId);
  const values = memberFormSchema.parse(input);
  const id = member._id.toString();

  if (values.name !== member.name || values.fatherName !== member.fatherName) {
    await assertNotDuplicate(values, id);
  }
  // Status changes must stay on or after the join date.
  const firstChange = member.statusHistory?.[0];
  if (firstChange && values.joinDate > dateKey(firstChange.date)) throw new AppError("statusBeforeJoin");

  const prev: Record<string, string> = {
    name: member.name,
    fatherName: member.fatherName,
    mobile: member.mobile,
    mohalla: member.mohalla,
    address: member.address,
    joinDate: dateKey(member.joinDate),
    notes: member.notes,
  };
  const next: Record<string, string> = { ...values };
  const changes: Record<string, { from: string; to: string }> = {};
  for (const key of Object.keys(prev)) {
    if (next[key] !== prev[key]) changes[key] = { from: prev[key], to: next[key] };
  }
  if (Object.keys(changes).length === 0) return;

  await Member.updateOne(
    { _id: member._id },
    { $set: { ...values, joinDate: toDate(values.joinDate) } },
    { runValidators: true },
  );
  await logActivity({ actorId: actor.id, action: "member.updated", entity: "Member", entityId: id, meta: { changes } });
}

/**
 * Records a status change with its reason and the day it took effect.
 * Left, deceased and exempt members get no bills for later months
 * (see isBillableMonth). A deceased member's own login is disabled.
 */
export async function changeMemberStatus(memberId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("members.manage");
  const member = await findMemberOrThrow(memberId);
  const values = memberStatusChangeSchema.parse(input);

  if (values.status === member.status) throw new AppError("statusUnchanged");
  if (values.date < dateKey(member.joinDate)) throw new AppError("statusBeforeJoin");
  const last = member.statusHistory?.at(-1);
  if (last && values.date < dateKey(last.date)) throw new AppError("statusBeforePrevious");

  const date = toDate(values.date);
  // Matching on the old status stops two heads changing it at the same moment.
  const result = await Member.updateOne(
    { _id: member._id, status: member.status },
    {
      $set: { status: values.status, statusChangedAt: date, statusReason: values.reason },
      $push: {
        statusHistory: {
          status: values.status,
          reason: values.reason,
          date,
          changedBy: new Types.ObjectId(actor.id),
          changedAt: new Date(),
        },
      },
    },
    { runValidators: true },
  );
  if (result.modifiedCount === 0) throw new AppError("statusUnchanged");

  await logActivity({
    actorId: actor.id,
    action: "member.status_changed",
    entity: "Member",
    entityId: member._id,
    meta: { from: member.status, to: values.status, date: values.date, reason: values.reason },
  });

  if (values.status === "deceased") {
    const login = await User.findOneAndUpdate(
      { memberId: member._id, role: "member", status: "active" },
      { $set: { status: "disabled" } },
    ).lean();
    if (login) {
      await logActivity({
        actorId: actor.id,
        action: "user.disabled",
        entity: "User",
        entityId: login._id,
        meta: { reason: "member_deceased", memberId: member._id.toString() },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

export type MemberExportRow = MemberListItem & { address: string; notes: string; statusReason: string };

export async function listMembersForExport(status: MemberStatus | null): Promise<MemberExportRow[]> {
  await requirePermission("members.read");
  const [members, linked] = await Promise.all([
    Member.find(status ? { status } : {})
      .select(`${LIST_FIELDS} address notes statusReason`)
      .sort({ memberNo: 1 })
      .collation(MEMBER_NO_ORDER)
      .lean<LeanMember[]>(),
    linkedMemberIdSet(),
  ]);
  const dues = await billDuesByMember(currentMonth());
  return members.map((m) => ({
    ...toListItem(m, linked, dues),
    address: m.address,
    notes: m.notes,
    statusReason: m.statusReason,
  }));
}
