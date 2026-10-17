"use client";

import { useState } from "react";
import { pageOf, PAGE_SIZE, type Page } from "@/lib/pagination";

/**
 * Pages a list that is filtered in the browser. `resetKey` describes the
 * filters: when it changes the list goes back to page 1.
 */
export function usePaging<T>(items: readonly T[], resetKey: string, size = PAGE_SIZE): Page<T> & { setPage: (page: number) => void } {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const current = pageOf(items, state.key === resetKey ? state.page : 1, size);
  return {
    ...current,
    setPage: (page: number) => {
      setState({ key: resetKey, page });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };
}
