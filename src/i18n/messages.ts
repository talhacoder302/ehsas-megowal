import en from "./en.json";
import ur from "./ur.json";
import type { Locale } from "./config";

// Both files must have exactly the same keys; tsc fails if one is missing a key.
export const messages = { en, ur } satisfies Record<Locale, typeof en> & Record<Locale, typeof ur>;

export type Messages = typeof en;
