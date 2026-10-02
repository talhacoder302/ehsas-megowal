import "server-only";
import { cache } from "react";
import { isValidObjectId } from "mongoose";
import type { Locale } from "@/i18n/config";
import { connectDB } from "@/lib/db";
import type { Role } from "@/lib/roles";
import { User } from "@/models";
import { auth } from "./index";

export type CurrentUser = {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  memberId: string | null;
  language: Locale;
  mustChangePassword: boolean;
};

/**
 * The signed-in user, loaded from the database once per request. Returns null
 * when nobody is signed in or the account was disabled or deleted. Role and
 * member link come from the database, so changes apply immediately even though
 * the JWT may be older.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id || !isValidObjectId(id)) return null;

  await connectDB();
  const user = await User.findById(id).lean();
  if (!user || user.status !== "active") return null;

  return {
    id: user._id.toString(),
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    memberId: user.memberId ? user.memberId.toString() : null,
    language: user.language,
    mustChangePassword: user.mustChangePassword,
  };
});
