import "server-only";
import { z } from "zod";

// Empty strings in .env files are treated as "not set".
const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  MONGODB_URI: z
    .string({ error: "MONGODB_URI is missing" })
    .trim()
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://"),
  MONGODB_DB: optional.transform((v) => v ?? "ehsas_megowal"),

  AUTH_SECRET: z
    .string({ error: "AUTH_SECRET is missing" })
    .trim()
    .min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: optional,
  AUTH_TRUST_HOST: optional,

  NEXT_PUBLIC_APP_URL: optional.transform((v) => v ?? "http://localhost:3000"),

  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  R2_PUBLIC_URL: optional,
  // Only for local testing against an S3-compatible server; normally built from the account id.
  R2_ENDPOINT: optional,

  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
});

type RawServerEnv = z.infer<typeof serverSchema>;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string | undefined;
  endpoint: string;
};

export type EmailConfig = {
  apiKey: string;
  from: string;
};

export type ServerEnv = RawServerEnv & {
  /** null when R2 is not configured; receipt photo uploads are then disabled. */
  r2: R2Config | null;
  /** null when Resend is not configured; emails are then skipped. */
  email: EmailConfig | null;
};

let cached: ServerEnv | null = null;

function warn(message: string) {
  if (process.env.NODE_ENV !== "test") console.warn(`[env] ${message}`);
}

function resolveR2(env: RawServerEnv): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  const required = [R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET];
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    return {
      accountId: R2_ACCOUNT_ID,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      bucket: R2_BUCKET,
      publicUrl: env.R2_PUBLIC_URL?.replace(/\/+$/, ""),
      endpoint: env.R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    };
  }
  if (required.some(Boolean)) warn("R2 is partly configured, photo uploads are disabled.");
  return null;
}

function resolveEmail(env: RawServerEnv): EmailConfig | null {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM };
  }
  if (env.RESEND_API_KEY || env.EMAIL_FROM) warn("Resend is partly configured, email is disabled.");
  return null;
}

/**
 * Validated server environment. Parsed on first use (not at import time) so
 * `next build` and pages that do not touch the database work without secrets.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${issues.join("\n")}\nSee .env.example.`);
  }

  cached = {
    ...parsed.data,
    r2: resolveR2(parsed.data),
    email: resolveEmail(parsed.data),
  };
  return cached;
}

export const features = {
  get uploads() {
    return getServerEnv().r2 !== null;
  },
  get email() {
    return getServerEnv().email !== null;
  },
};
