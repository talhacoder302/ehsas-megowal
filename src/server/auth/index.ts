import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig, tokenFields } from "./config";
import { loadSessionUser, verifyLogin, type LoginFailure } from "./login";

/** Carries the failure reason to the login action as `error.code`. */
class LoginFailed extends CredentialsSignin {
  constructor(reason: LoginFailure) {
    super();
    this.code = reason;
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  logger: {
    // A wrong password is normal; do not print a stack trace for it.
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Credentials({
      credentials: { mobile: {}, password: {} },
      async authorize(credentials) {
        const result = await verifyLogin(credentials);
        if (!result.ok) throw new LoginFailed(result.reason);
        return result.user;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      // On update() we reload from the database and ignore any data sent by the
      // client, so a user can never raise their own role from the browser.
      if (params.trigger === "update" && token.userId) {
        const fresh = await loadSessionUser(token.userId);
        if (!fresh) return null;
        Object.assign(token, tokenFields(fresh));
      }
      return token;
    },
  },
});
