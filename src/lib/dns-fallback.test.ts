import { describe, expect, it } from "vitest";
import { needsPublicDns } from "./dns-fallback";

const SRV = "mongodb+srv://user:pass@cluster0.example.mongodb.net/?retryWrites=true";

describe("needsPublicDns", () => {
  it("steps in when Node only knows 127.0.0.1 (the broken Windows case)", () => {
    expect(needsPublicDns(SRV, ["127.0.0.1"])).toBe(true);
    expect(needsPublicDns(SRV, ["::1"])).toBe(true);
    expect(needsPublicDns(SRV, [])).toBe(true);
  });

  it("leaves working DNS alone", () => {
    expect(needsPublicDns(SRV, ["101.50.101.50", "101.50.101.51"])).toBe(false);
    expect(needsPublicDns(SRV, ["127.0.0.1", "8.8.8.8"])).toBe(false);
  });

  it("never touches plain mongodb:// addresses (no SRV lookup needed)", () => {
    expect(needsPublicDns("mongodb://127.0.0.1:27017", ["127.0.0.1"])).toBe(false);
  });
});
