import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for the RateLimitHit collection.
let hits: { key: string; createdAt: Date }[] = [];
vi.mock("@/lib/db", () => ({ connectDB: async () => undefined }));
vi.mock("@/models", () => ({
  RATE_LIMIT_MAX_WINDOW_SECONDS: 86_400,
  RateLimitHit: {
    countDocuments: async (q: { key: string; createdAt: { $gt: Date } }) =>
      hits.filter((h) => h.key === q.key && h.createdAt > q.createdAt.$gt).length,
    create: async (doc: { key: string }) => {
      hits.push({ key: doc.key, createdAt: new Date() });
    },
  },
}));

const { assertRateLimit, RATE_LIMITS } = await import("./rate-limit");

beforeEach(() => {
  hits = [];
});

describe("assertRateLimit", () => {
  it("allows uploads up to the limit, then refuses", async () => {
    for (let i = 0; i < RATE_LIMITS.upload.limit; i += 1) await assertRateLimit("upload", "u1");
    await expect(assertRateLimit("upload", "u1")).rejects.toMatchObject({ code: "tooManyRequests" });
  });

  it("counts each person and each action separately", async () => {
    for (let i = 0; i < RATE_LIMITS.upload.limit; i += 1) await assertRateLimit("upload", "u1");
    await expect(assertRateLimit("upload", "u2")).resolves.toBeUndefined();
    await expect(assertRateLimit("import", "u1")).resolves.toBeUndefined();
  });

  it("forgets hits older than the window", async () => {
    const old = new Date(Date.now() - (RATE_LIMITS.reportEmail.windowSeconds + 60) * 1000);
    hits = Array.from({ length: RATE_LIMITS.reportEmail.limit }, () => ({ key: "reportEmail:u1", createdAt: old }));
    await expect(assertRateLimit("reportEmail", "u1")).resolves.toBeUndefined();
  });
});
