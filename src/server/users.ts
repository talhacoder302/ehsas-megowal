import "server-only";
import { mongo, Types } from "mongoose";
import type { Locale } from "@/i18n/config";
import { AppError } from "@/lib/errors";
import { requireRole, requireUser } from "@/lib/permissions";
import type { Role } from "@/lib/roles";
import {
  changePasswordSchema,
  languageSchema,
  objectIdSchema,
  setPasswordSchema,
  userFormSchema,
  type UserFormValues,
} from "@/lib/validators";
import { LoginAttempt, Member, User, type UserDoc, type UserStatus } from "@/models";
import { logActivity } from "./activity-log";
import { generateTempPassword, hashPassword, verifyPassword } from "./passwords";

export type UserListItem = {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  status: UserStatus;
  language: Locale;
  memberId: string | null;
  memberNo: string | null;
  memberName: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type OwnProfile = {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  language: Locale;
  member: { id: string; memberNo: string; name: string } | null;
};

type LeanUser = UserDoc & { createdAt?: Date };

async function memberLookup(memberIds: (Types.ObjectId | null | undefined)[]) {
  const ids = memberIds.filter((id): id is Types.ObjectId => Boolean(id));
  if (ids.length === 0) return new Map<string, { memberNo: string; name: string }>();
  const members = await Member.find({ _id: { $in: ids } }).select("memberNo name").lean();
  return new Map(members.map((m) => [m._id.toString(), { memberNo: m.memberNo, name: m.name }]));
}

function toListItem(user: LeanUser, members: Map<string, { memberNo: string; name: string }>): UserListItem {
  const memberId = user.memberId ? user.memberId.toString() : null;
  const member = memberId ? members.get(memberId) : undefined;
  return {
    id: user._id.toString(),
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    status: user.status,
    language: user.language,
    memberId,
    memberNo: member?.memberNo ?? null,
    memberName: member?.name ?? null,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: (user.createdAt ?? user._id.getTimestamp()).toISOString(),
  };
}

async function listItemFor(user: LeanUser): Promise<UserListItem> {
  return toListItem(user, await memberLookup([user.memberId]));
}

async function findUserOrThrow(userId: string): Promise<LeanUser> {
  const id = objectIdSchema.parse(userId);
  const user = await User.findById(id).lean<LeanUser>();
  if (!user) throw new AppError("notFound");
  return user;
}

async function assertMobileFree(mobile: string, exceptUserId?: string) {
  const existing = await User.findOne({ mobile }).select("_id").lean();
  if (existing && existing._id.toString() !== exceptUserId) throw new AppError("mobileTaken");
}

async function assertMemberLinkable(memberId: string | null, exceptUserId?: string) {
  if (!memberId) return;
  const member = await Member.exists({ _id: memberId });
  if (!member) throw new AppError("memberNotFound");
  const linked = await User.findOne({ memberId }).select("_id").lean();
  if (linked && linked._id.toString() !== exceptUserId) throw new AppError("memberAlreadyLinked");
}

async function assertNotLastAdmin(user: LeanUser) {
  if (user.role !== "admin" || user.status !== "active") return;
  const others = await User.countDocuments({ _id: { $ne: user._id }, role: "admin", status: "active" });
  if (others === 0) throw new AppError("lastAdmin");
}

/** Turns a unique-index race into the same error the pre-checks would give. */
function mapDuplicateKey(error: unknown): never {
  if (error instanceof mongo.MongoServerError && error.code === 11000) {
    const keys = Object.keys((error.keyPattern as Record<string, unknown> | undefined) ?? {});
    throw new AppError(keys.includes("memberId") ? "memberAlreadyLinked" : "mobileTaken");
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Admin: user management
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<UserListItem[]> {
  await requireRole("admin");
  const users = await User.find().sort({ status: 1, role: 1, name: 1 }).lean<LeanUser[]>();
  const members = await memberLookup(users.map((u) => u.memberId));
  return users.map((u) => toListItem(u, members));
}

export async function createUser(input: unknown): Promise<{ user: UserListItem; tempPassword: string }> {
  const actor = await requireRole("admin");
  const values: UserFormValues = userFormSchema.parse(input);

  await assertMobileFree(values.mobile);
  await assertMemberLinkable(values.memberId);

  const tempPassword = generateTempPassword();
  const created = await User.create({
    name: values.name,
    mobile: values.mobile,
    role: values.role,
    memberId: values.memberId,
    language: values.language,
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
    status: "active",
  }).catch(mapDuplicateKey);

  await logActivity({
    actorId: actor.id,
    action: "user.created",
    entity: "User",
    entityId: created._id,
    meta: { name: values.name, mobile: values.mobile, role: values.role, memberId: values.memberId },
  });

  return { user: await listItemFor(created.toObject<LeanUser>()), tempPassword };
}

export async function updateUser(userId: string, input: unknown): Promise<UserListItem> {
  const actor = await requireRole("admin");
  const user = await findUserOrThrow(userId);
  const values: UserFormValues = userFormSchema.parse(input);
  const id = user._id.toString();

  if (values.role !== user.role) {
    if (id === actor.id) throw new AppError("cannotChangeOwnRole");
    await assertNotLastAdmin(user);
  }
  if (values.mobile !== user.mobile) await assertMobileFree(values.mobile, id);
  const currentMemberId = user.memberId ? user.memberId.toString() : null;
  if (values.memberId !== currentMemberId) await assertMemberLinkable(values.memberId, id);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const next: Record<string, unknown> = {
    name: values.name,
    mobile: values.mobile,
    role: values.role,
    memberId: values.memberId,
    language: values.language,
  };
  const prev: Record<string, unknown> = {
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    memberId: currentMemberId,
    language: user.language,
  };
  for (const key of Object.keys(next)) {
    if (next[key] !== prev[key]) changes[key] = { from: prev[key], to: next[key] };
  }
  if (Object.keys(changes).length === 0) return listItemFor(user);

  const updated = await User.findByIdAndUpdate(
    id,
    { $set: { ...next, memberId: values.memberId ? new Types.ObjectId(values.memberId) : null } },
    { returnDocument: "after", runValidators: true },
  )
    .lean<LeanUser>()
    .catch(mapDuplicateKey);
  if (!updated) throw new AppError("notFound");

  await logActivity({ actorId: actor.id, action: "user.updated", entity: "User", entityId: id, meta: { changes } });
  return listItemFor(updated);
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<UserListItem> {
  const actor = await requireRole("admin");
  const user = await findUserOrThrow(userId);
  if (user.status === status) return listItemFor(user);

  if (status === "disabled") {
    if (user._id.toString() === actor.id) throw new AppError("cannotDisableSelf");
    await assertNotLastAdmin(user);
  }

  const updated = await User.findByIdAndUpdate(user._id, { $set: { status } }, { returnDocument: "after" }).lean<LeanUser>();
  if (!updated) throw new AppError("notFound");

  await logActivity({
    actorId: actor.id,
    action: status === "disabled" ? "user.disabled" : "user.enabled",
    entity: "User",
    entityId: user._id,
  });
  return listItemFor(updated);
}

/** Sets a new temporary password; the user must change it at next login. */
export async function resetUserPassword(userId: string): Promise<{ user: UserListItem; tempPassword: string }> {
  const actor = await requireRole("admin");
  const user = await findUserOrThrow(userId);

  const tempPassword = generateTempPassword();
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true } },
    { returnDocument: "after" },
  ).lean<LeanUser>();
  if (!updated) throw new AppError("notFound");

  // A reset also lifts any login lockout for this number.
  await LoginAttempt.deleteMany({ mobile: user.mobile });

  await logActivity({ actorId: actor.id, action: "user.password_reset", entity: "User", entityId: user._id });
  return { user: await listItemFor(updated), tempPassword };
}

// ---------------------------------------------------------------------------
// Any signed-in user: own profile
// ---------------------------------------------------------------------------

export async function getOwnProfile(): Promise<OwnProfile> {
  const me = await requireUser();
  const member = me.memberId ? await Member.findById(me.memberId).select("memberNo name").lean() : null;
  return {
    id: me.id,
    name: me.name,
    mobile: me.mobile,
    role: me.role,
    language: me.language,
    member: member ? { id: member._id.toString(), memberNo: member.memberNo, name: member.name } : null,
  };
}

export async function changeOwnPassword(input: unknown): Promise<void> {
  const me = await requireUser();
  const values = changePasswordSchema.parse(input);

  const user = await User.findById(me.id).select("+passwordHash").lean();
  if (!user) throw new AppError("notFound");
  if (!(await verifyPassword(values.currentPassword, user.passwordHash))) throw new AppError("wrongPassword");

  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(values.newPassword), mustChangePassword: false } },
  );
  await logActivity({ actorId: me.id, action: "user.password_changed", entity: "User", entityId: me.id });
}

/** The forced change after login with a temporary password. */
export async function setOwnPassword(input: unknown): Promise<void> {
  const me = await requireUser();
  if (!me.mustChangePassword) throw new AppError("forbidden");
  const values = setPasswordSchema.parse(input);

  const user = await User.findById(me.id).select("+passwordHash").lean();
  if (!user) throw new AppError("notFound");
  if (await verifyPassword(values.newPassword, user.passwordHash)) throw new AppError("passwordSameAsTemp");

  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(values.newPassword), mustChangePassword: false } },
  );
  await logActivity({
    actorId: me.id,
    action: "user.password_changed",
    entity: "User",
    entityId: me.id,
    meta: { forced: true },
  });
}

export async function setOwnLanguage(input: unknown): Promise<Locale> {
  const me = await requireUser();
  const language = languageSchema.parse(input);
  if (language === me.language) return language;

  await User.updateOne({ _id: me.id }, { $set: { language } });
  await logActivity({
    actorId: me.id,
    action: "user.language_changed",
    entity: "User",
    entityId: me.id,
    meta: { from: me.language, to: language },
  });
  return language;
}
