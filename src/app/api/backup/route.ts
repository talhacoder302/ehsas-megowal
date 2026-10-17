import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { buildBackupWorkbook } from "@/server/backup";

// PDF and Excel files can take a few seconds on a cold start.
export const maxDuration = 60;

const STATUS: Partial<Record<string, number>> = { unauthenticated: 401, forbidden: 403, tooManyRequests: 429 };

// GET /api/backup  -> every collection as one Excel file (admin only).
export async function GET() {
  try {
    const { filename, body } = await buildBackupWorkbook();
    return new NextResponse(body as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && STATUS[error.code]) return NextResponse.json({ error: error.code }, { status: STATUS[error.code] });
    console.error("[backup]", error);
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
