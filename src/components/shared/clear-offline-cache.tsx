"use client";

import { useEffect } from "react";

/** Same name as in src/sw.ts. */
const OFFLINE_LISTS_CACHE = "offline-lists";

/**
 * Mounted on the login page: once nobody is signed in, the lists kept for
 * offline reading are removed so the next person on this phone cannot see them.
 */
export function ClearOfflineCache() {
  useEffect(() => {
    if ("caches" in window) void caches.delete(OFFLINE_LISTS_CACHE);
  }, []);
  return null;
}
