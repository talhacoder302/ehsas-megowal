import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./app-url";

describe("resolveAppUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when it is set", () => {
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "https://ehsas.talhacoder.com/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe(
      "https://ehsas.talhacoder.com",
    );
  });

  it("falls back to the Vercel production domain, then the deployment address", () => {
    expect(resolveAppUrl({ VERCEL_PROJECT_PRODUCTION_URL: "ehsas-megowal.vercel.app", VERCEL_URL: "ehsas-abc.vercel.app" })).toBe(
      "https://ehsas-megowal.vercel.app",
    );
    expect(resolveAppUrl({ VERCEL_URL: "ehsas-abc.vercel.app" })).toBe("https://ehsas-abc.vercel.app");
  });

  it("is localhost when nothing is set", () => {
    expect(resolveAppUrl({ NEXT_PUBLIC_APP_URL: "  " })).toBe("http://localhost:3000");
  });
});
