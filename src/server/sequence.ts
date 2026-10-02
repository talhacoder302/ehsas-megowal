import "server-only";
import { Counter } from "@/models";

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

/** 7 -> "EP-007" */
export function formatMemberNo(seq: number): string {
  return `EP-${String(seq).padStart(3, "0")}`;
}
