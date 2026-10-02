import "server-only";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { postLoginPath } from "@/lib/roles";
import { loginSchema } from "@/lib/validators";
import { LOGIN_WINDOW_SECONDS, LoginAttempt, User, type UserDoc } from "@/models";
import type { SessionUser } from "./config";

// Called by the Auth.js Credentials provider before anyone is signed in, so
// these functions do not (and cannot) check a session.

export const MAX_FAILED_LOGINS = 5;

export type LoginFailure = "invalid" | "rate_limited" | "disabled";
export type LoginResult = { ok: true; user: SessionUser } | { ok: false; reason: LoginFailure };

let dummyHash: string | null = null;
// Compare against a dummy hash for unknown mobiles so response time does not reveal which numbers exist.
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("not-a-real-password", 10);
  return dummyHash;
}

export function toSessionUser(user: Pick<UserDoc, "_id" | "name" | "role" | "memberId" | "language" | "mustChangePassword">): SessionUser {
  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role,
    memberId: user.memberId ? user.memberId.toString() : null,
    language: user.language,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function countRecentFailures(mobile: string): Promise<number> {
  const since = new Date(Date.now() - LOGIN_WINDOW_SECONDS * 1000);
  return LoginAttempt.countDocuments({ mobile, createdAt: { $gte: since } });
}

export async function verifyLogin(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { mobile, password } = parsed.data;

  await connectDB();

  if ((await countRecentFailures(mobile)) >= MAX_FAILED_LOGINS) {
    return { ok: false, reason: "rate_limited" };
  }

  const user = await User.findOne({ mobile }).select("+passwordHash").lean();
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());

  if (!user || !passwordOk) {
    await LoginAttempt.create({ mobile });
    const failures = await countRecentFailures(mobile);
    return { ok: false, reason: failures >= MAX_FAILED_LOGINS ? "rate_limited" : "invalid" };
  }

  // Only reveal "disabled" after the correct password was given.
  if (user.status !== "active") return { ok: false, reason: "disabled" };

  await Promise.all([
    LoginAttempt.deleteMany({ mobile }),
    User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }),
  ]);

  return { ok: true, user: toSessionUser(user) };
}

/**
 * Where to go right after a successful sign-in (the new session cookie is not
 * readable in the same request, so this looks the user up by mobile).
 */
export async function getLoginLanding(
  mobile: string,
  callbackUrl: unknown,
): Promise<{ path: string; language: SessionUser["language"] }> {
  await connectDB();
  const user = await User.findOne({ mobile, status: "active" }).lean();
  if (!user) return { path: "/login", language: "en" };
  const memberId = user.memberId ? user.memberId.toString() : null;
  return {
    path: user.mustChangePassword ? "/change-password" : postLoginPath(user.role, memberId, callbackUrl),
    language: user.language,
  };
}

/** Fresh session data from the database; null if the user is gone or disabled. */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  if (!isValidObjectId(userId)) return null;
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user || user.status !== "active") return null;
  return toSessionUser(user);
}
