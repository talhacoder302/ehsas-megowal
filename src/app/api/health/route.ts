import { NextResponse } from "next/server";
import { checkDatabase } from "@/server/health";

export async function GET() {
  const db = await checkDatabase();
  return NextResponse.json(
    { status: db.ok ? "ok" : "degraded", db: db.ok ? "up" : "down", time: new Date().toISOString() },
    { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
