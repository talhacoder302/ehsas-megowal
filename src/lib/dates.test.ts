import { afterEach, describe, expect, it, vi } from "vitest";
import { dateKey, formatDateTime, monthKey, parseDateKey, pastDateKeySchema, todayKey } from "./dates";

afterEach(() => {
  vi.useRealTimers();
});

describe("parseDateKey / dateKey", () => {
  it("reads a day as midnight in Pakistan time", () => {
    expect(parseDateKey("2026-10-04")?.toISOString()).toBe("2026-10-03T19:00:00.000Z");
  });

  it("round-trips", () => {
    for (const key of ["2023-01-01", "2024-02-29", "2026-12-31"]) {
      const date = parseDateKey(key);
      expect(date).not.toBeNull();
      expect(dateKey(date as Date)).toBe(key);
    }
  });

  it("rejects impossible or badly written dates", () => {
    for (const value of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-5", "04/10/2026", ""]) {
      expect(parseDateKey(value)).toBeNull();
    }
  });

  it("uses the Pakistan day, not the UTC day", () => {
    // 20:30 UTC on 3 Oct is 01:30 on 4 Oct in Pakistan.
    expect(dateKey("2026-10-03T20:30:00.000Z")).toBe("2026-10-04");
    expect(monthKey("2026-09-30T19:30:00.000Z")).toBe("2026-10");
  });
});

describe("pastDateKeySchema", () => {
  it("accepts today and earlier days, rejects the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T10:00:00.000Z"));
    expect(todayKey()).toBe("2026-10-04");
    expect(pastDateKeySchema.safeParse("2026-10-04").success).toBe(true);
    expect(pastDateKeySchema.safeParse("2020-01-01").success).toBe(true);

    const future = pastDateKeySchema.safeParse("2026-10-05");
    expect(future.success).toBe(false);
    expect(future.error?.issues[0].message).toBe("dateInFuture");
  });

  it("gives translatable messages for empty and invalid input", () => {
    expect(pastDateKeySchema.safeParse("").error?.issues[0].message).toBe("dateRequired");
    expect(pastDateKeySchema.safeParse("2026-02-30").error?.issues[0].message).toBe("dateInvalid");
  });
});

describe("formatDateTime", () => {
  it("shows Pakistan time", () => {
    expect(formatDateTime("2026-10-04T11:05:00.000Z")).toMatch(/4 Oct 2026.*4:05/);
  });
});
