import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, originOf } from "./security";

describe("contentSecurityPolicy", () => {
  const base = { nonce: "abc123", dev: false, https: true, connect: [] };

  it("only runs scripts with the nonce and blocks framing and plugins", () => {
    const csp = contentSecurityPolicy(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development and never upgrades plain http", () => {
    const csp = contentSecurityPolicy({ ...base, dev: true, https: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("lets photo uploads reach R2", () => {
    expect(contentSecurityPolicy({ ...base, connect: ["http://localhost:9810"] })).toContain(
      "connect-src 'self' https://*.r2.cloudflarestorage.com http://localhost:9810",
    );
  });
});

describe("originOf", () => {
  it("keeps only scheme, host and port", () => {
    expect(originOf("https://abc.r2.cloudflarestorage.com/bucket/key")).toBe("https://abc.r2.cloudflarestorage.com");
    expect(originOf("not a url")).toBeNull();
    expect(originOf(undefined)).toBeNull();
  });
});
