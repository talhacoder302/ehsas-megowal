import "server-only";
import type { Types } from "mongoose";
import type { Locale } from "@/i18n/config";
import { dateKey } from "@/lib/dates";
import { connectDB } from "@/lib/db";
import type { MemberStatus } from "@/lib/member-status";
import type { Role } from "@/lib/roles";
import { DEFAULT_MEMBER_NO_PREFIX, Member, Settings, User, type SettingsDoc } from "@/models";
import { logActivity } from "./activity-log";
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
