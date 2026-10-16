import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { isImportKind } from "@/lib/imports";
import { buildImportTemplate } from "@/server/imports";

const STATUS: Partial<Record<string, number>> = { unauthenticated: 401, forbidden: 403 };

// GET /api/import/template/members  -> an empty Excel template with examples and a help sheet (staff).
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isImportKind(kind)) return NextResponse.json({ error: "notFound" }, { status: 404 });
  try {
    const { filename, body } = await buildImportTemplate(kind);
    return new NextResponse(body as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && STATUS[error.code]) return NextResponse.json({ error: error.code }, { status: STATUS[error.code] });
    console.error("[import template]", error);
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
