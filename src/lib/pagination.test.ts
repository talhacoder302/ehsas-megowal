import { describe, expect, it } from "vitest";
import { pageCount, pageOf, pageWindow, parsePage } from "./pagination";

describe("pagination", () => {
  it("counts pages, never fewer than one", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
  });

  it("reads page numbers safely", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("9", 4)).toBe(4);
  });

  it("slices a list and keeps the page in range", () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    expect(pageOf(items, 2, 25)).toEqual({ items: [25, 26, 27, 28, 29], page: 2, pageCount: 2, total: 30 });
    expect(pageOf(items, 7, 25).page).toBe(2);
    expect(pageOf([], 1, 25)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });

  it("gives skip and limit for a page", () => {
    expect(pageWindow(1, 25)).toEqual({ skip: 0, limit: 25 });
    expect(pageWindow(3, 25)).toEqual({ skip: 50, limit: 25 });
  });
});
