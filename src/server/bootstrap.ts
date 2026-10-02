import "server-only";
import { connectDB } from "@/lib/db";
import { Settings, type SettingsDoc } from "@/models";

// System-level setup used only by scripts (seed, migrations). Never call these
// from Server Actions or route handlers; they do not check a session.

/** Creates collections and indexes for all registered models. */
export async function syncModelIndexes(): Promise<string[]> {
  const conn = await connectDB();
  const names: string[] = [];
  for (const name of conn.modelNames()) {
    const m = conn.model(name);
    await m.createCollection();
    await m.syncIndexes();
    names.push(name);
  }
  return names;
}

/** Inserts the settings singleton if it does not exist yet. Existing values are kept. */
export async function ensureDefaultSettings(): Promise<SettingsDoc> {
  await connectDB();
  const doc = await Settings.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  if (!doc) throw new Error("Could not create settings");
  return doc;
}
