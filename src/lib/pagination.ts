// Page numbers for long lists. Pure, safe on the client, the server and in tests.

/** Rows per page on every paged list. */
export const PAGE_SIZE = 25;

export type Page<T> = { items: T[]; page: number; pageCount: number; total: number };

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** "?page=3" (or garbage) -> a page number from 1 to `count`. */
export function parsePage(value: unknown, count = Number.MAX_SAFE_INTEGER): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? value : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), Math.max(1, count));
}

/** The slice of `items` on `page` (for lists already filtered in the browser). */
export function pageOf<T>(items: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const count = pageCount(items.length, size);
  const current = parsePage(page, count);
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount: count, total: items.length };
}

/** skip/limit for a database query on `page`. */
export function pageWindow(page: number, size = PAGE_SIZE): { skip: number; limit: number } {
  return { skip: (Math.max(1, page) - 1) * size, limit: size };
}
