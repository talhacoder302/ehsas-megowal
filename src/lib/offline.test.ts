import { afterEach, describe, expect, it, vi } from "vitest";
import { callAction } from "./offline";
import { containsPattern } from "./search";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callAction", () => {
  it("never calls the action while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const action = vi.fn(async () => ({ ok: true as const, data: 1 }));
    await expect(callAction(action)).resolves.toEqual({ ok: false, error: "offline" });
    expect(action).not.toHaveBeenCalled();
  });

  it("passes the result through when online", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    await expect(callAction(async () => ({ ok: true as const, data: "R-0001" }))).resolves.toEqual({ ok: true, data: "R-0001" });
  });

  it("turns a dropped connection into a clear error", async () => {
    const nav = { onLine: true };
    vi.stubGlobal("navigator", nav);
    const result = await callAction(async () => {
      nav.onLine = false;
      throw new TypeError("Failed to fetch");
    });
    expect(result).toEqual({ ok: false, error: "offline" });
  });

  it("reports other failures as unknown", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    await expect(callAction(async () => Promise.reject(new Error("boom")))).resolves.toEqual({ ok: false, error: "unknown" });
  });
});

describe("containsPattern", () => {
  it("matches text anywhere, ignoring case", () => {
    expect(containsPattern("riaz").test("Muhammad Riaz")).toBe(true);
  });

  it("treats regex characters as plain text", () => {
    expect(containsPattern("R-0001 (").test("R-0001 (copy)")).toBe(true);
    expect(containsPattern(".*").test("anything")).toBe(false);
  });
});
