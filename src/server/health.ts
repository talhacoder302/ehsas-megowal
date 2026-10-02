import "server-only";
import { connectDB } from "@/lib/db";

export type DatabaseHealth = { ok: true; latencyMs: number } | { ok: false };

// Public on purpose (used by /api/health); returns no data beyond up/down.
export async function checkDatabase(): Promise<DatabaseHealth> {
  try {
    const started = Date.now();
    const conn = await connectDB();
    await conn.connection.db?.admin().ping();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    console.error("[health] database check failed", error);
    return { ok: false };
  }
}
