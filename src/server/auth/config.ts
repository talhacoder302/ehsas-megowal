import type { NextAuthConfig, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { defaultLocale, isLocale } from "@/i18n/config";
import { isRole } from "@/lib/roles";

// Shared Auth.js config with no database access, so the proxy can use it.
// The full config with the Credentials provider lives in ./index.ts.

export type SessionUser = {
  id: string;
  name: string;
  role: NonNullable<User["role"]>;
  memberId: string | null;
  language: NonNullable<User["language"]>;
  mustChangePassword: boolean;
};

export function tokenFields(user: SessionUser): JWT {
  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    memberId: user.memberId,
    language: user.language,
    mustChangePassword: user.mustChangePassword,
  };
}

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id && isRole(user.role)) {
        Object.assign(
          token,
          tokenFields({
            id: user.id,
            name: user.name ?? "",
            role: user.role,
            memberId: user.memberId ?? null,
            language: isLocale(user.language) ? user.language : defaultLocale,
            mustChangePassword: user.mustChangePassword ?? false,
          }),
        );
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId && isRole(token.role)) {
        session.user = {
          ...session.user,
          id: token.userId,
          name: token.name ?? "",
          role: token.role,
          memberId: token.memberId ?? null,
          language: isLocale(token.language) ? token.language : defaultLocale,
          mustChangePassword: token.mustChangePassword ?? false,
        };
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
