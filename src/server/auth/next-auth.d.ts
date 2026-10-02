import type { DefaultSession } from "next-auth";
import type { Locale } from "@/i18n/config";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role?: Role;
    memberId?: string | null;
    language?: Locale;
    mustChangePassword?: boolean;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      role: Role;
      memberId: string | null;
      language: Locale;
      mustChangePassword: boolean;
    } & Omit<DefaultSession["user"], "name">;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    memberId?: string | null;
    language?: Locale;
    mustChangePassword?: boolean;
  }
}
