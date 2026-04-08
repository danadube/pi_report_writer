import { NextResponse } from "next/server";

/**
 * POST /api/pdf
 * Accepts { reportId } and returns a generated PDF.
 *
 * TODO: Implement server-side PDF generation using Puppeteer or @react-pdf/renderer.
 * For MVP, the client-side window.print() approach in ReportPrintView is sufficient.
 */
export async function POST() {
  // TODO: Implement server-side PDF generation
  return NextResponse.json(
    { error: "Server-side PDF generation not yet implemented" },
    { status: 501 }
  );
}
