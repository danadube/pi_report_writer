/**
 * Supabase Storage bucket for report PDFs and attachments.
 *
 * Create in Supabase Dashboard → Storage → New bucket → id `report-files`.
 * For public download links (as stored in report_sources.file_url), mark the
 * bucket public or add a signed-URL download route later.
 *
 * TODO: Add storage RLS policies so authenticated users can upload only under
 * `reports/{reportId}/` for reports they own (next phase hardening).
 */
export const REPORT_FILES_BUCKET = "report-files";

const PDF_MIME = "application/pdf";
const MAX_BYTES = 20 * 1024 * 1024;

export function sanitizeStorageFileName(originalName: string): string {
  const trimmed = originalName.trim() || "document.pdf";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

export function assertPdfFile(file: File): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File must be ${MAX_BYTES / (1024 * 1024)}MB or smaller`,
    };
  }

  const hasPdfExt = file.name.toLowerCase().endsWith(".pdf");
  if (!hasPdfExt) {
    return { ok: false, error: "Only PDF files are allowed" };
  }

  if (file.type !== "" && file.type !== PDF_MIME) {
    return { ok: false, error: "Only PDF files are allowed" };
  }

  return { ok: true };
}

export function buildReportObjectPath(reportId: string, originalFileName: string): string {
  const stamp = Date.now();
  const safe = sanitizeStorageFileName(originalFileName);
  return `reports/${reportId}/${stamp}-${safe}`;
}
