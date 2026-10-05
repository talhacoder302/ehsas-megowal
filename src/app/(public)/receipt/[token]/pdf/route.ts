import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { renderReceiptPdf } from "@/server/pdf/receipt-pdf";
import { getReceiptByToken } from "@/server/payments";

// GET /receipt/<token>/pdf?lang=ur  -> the receipt as a PDF. Public like the receipt page.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = await getReceiptByToken(token);
  if (!receipt) return NextResponse.json({ error: "notFound" }, { status: 404 });

  const lang = request.nextUrl.searchParams.get("lang");
  const locale = isLocale(lang) ? lang : "en";
  try {
    const pdf = await renderReceiptPdf(receipt, locale);
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt-${receipt.receiptNumber}-${locale}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[receipt pdf]", error);
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
