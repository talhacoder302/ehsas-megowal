import "server-only";
import { connectDB } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { RATE_LIMIT_MAX_WINDOW_SECONDS, RateLimitHit } from "@/models";

/** Limits per signed-in user. Generous for normal use, tight enough to stop a script or a stuck button. */
export const RATE_LIMITS = {
  upload: { limit: 40, windowSeconds: 10 * 60 },
  import: { limit: 30, windowSeconds: 10 * 60 },
  reportEmail: { limit: 5, windowSeconds: 60 * 60 },
  backup: { limit: 10, windowSeconds: 60 * 60 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Counts this use of `name` by `userId` and refuses it (tooManyRequests) once
 * the limit for the window is reached. Internal: callers check the session first.
 */
export async function assertRateLimit(name: RateLimitName, userId: string): Promise<void> {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  const window = Math.min(windowSeconds, RATE_LIMIT_MAX_WINDOW_SECONDS);
  const key = `${name}:${userId}`;
  await connectDB();
  const recent = await RateLimitHit.countDocuments({ key, createdAt: { $gt: new Date(Date.now() - window * 1000) } });
  if (recent >= limit) throw new AppError("tooManyRequests");
  await RateLimitHit.create({ key });
}
