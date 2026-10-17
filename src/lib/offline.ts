"use client";

import { useSyncExternalStore } from "react";
import type { ActionResult } from "@/lib/errors";

// Connection handling on the client. Nothing is saved or queued while offline:
// a Server Action called without internet returns the "offline" error at once.

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** true while the browser has a connection (always true on the server). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

function offlineNow(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Runs a Server Action, but never while offline: without internet it returns
 * { ok: false, error: "offline" } instead of a failed request (and nothing is
 * sent later). A request that fails half-way is reported the same way.
 */
export async function callAction<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  if (offlineNow()) return { ok: false, error: "offline" };
  try {
    return await action();
  } catch {
    return { ok: false, error: offlineNow() ? "offline" : "unknown" };
  }
}
