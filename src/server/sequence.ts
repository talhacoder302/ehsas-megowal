import "server-only";
import { Counter, DEFAULT_MEMBER_NO_PREFIX } from "@/models";
import { readSettings } from "./settings";

/** Atomically returns the next number for a sequence ("member", "receipt", "case"). Starts at 1. */
export async function nextSequence(name: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  if (!counter) throw new Error(`Could not advance sequence ${name}`);
  return counter.seq;
}

/** (7, "EP-") -> "EP-007". Numbers past 999 simply grow: "EP-1000". */
export function formatMemberNo(seq: number, prefix: string = DEFAULT_MEMBER_NO_PREFIX): string {
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

/** Takes the next member number, using the prefix from Settings. */
export async function nextMemberNo(): Promise<string> {
  const { memberNoPrefix } = await readSettings();
  return formatMemberNo(await nextSequence("member"), memberNoPrefix);
}
