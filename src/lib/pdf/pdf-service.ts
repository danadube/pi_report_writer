import type { Report } from "@/types";

/**
 * TODO: Implement PDF generation service.
 *
 * Recommended approach for MVP:
 * - Render the report as an HTML page at /dashboard/reports/[reportId]/print
 * - Use window.print() with print-specific CSS for basic export
 * - OR use a server-side HTML-to-PDF approach (e.g., Puppeteer or @react-pdf/renderer)
 *   via the /api/pdf/generate route
 *
 * The generated PDF should:
 * - Include company branding in the header (organization name/logo)
 * - Use a clean, professional layout suitable for attorneys and courts
 * - Include page numbers and report metadata in the footer
 */

/**
 * Client-side: trigger browser print dialog for the current print preview page.
 * Simple and reliable for MVP.
 */
export function printReport(): void {
  window.print();
}

/**
 * TODO: Server-side PDF generation.
 * Calls /api/pdf/generate with the report ID and returns a PDF blob URL.
 */
export async function generatePdfServerSide(reportId: string): Promise<string> {
  // TODO: POST to /api/pdf/generate with { reportId }
  // Return blob URL for download
  throw new Error("Server-side PDF generation not yet implemented");
}

/**
 * TODO: Build the HTML string used for PDF rendering.
 * This will be the server-rendered version of the print preview component.
 */
export function buildReportHtml(report: Report): string {
  // TODO: Render ReportPrintView to HTML string using renderToStaticMarkup
  // Include inline styles since many PDF renderers strip external stylesheets
  throw new Error("Report HTML builder not yet implemented");
}
