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

/**
 * Canonical public URL for an object in a public bucket — same pattern as
 * `@supabase/storage-js` StorageFileApi.getPublicUrl (object/public/...).
 */
export function buildStoragePublicObjectUrl(
  supabaseProjectUrl: string,
  bucket: string,
  objectPath: string
): string {
  const base = supabaseProjectUrl.replace(/\/$/, "");
  const path = objectPath.replace(/^\/+/, "");
  return encodeURI(`${base}/storage/v1/object/public/${bucket}/${path}`);
}

/**
 * NEXT_PUBLIC_SUPABASE_URL must be the Supabase API origin (e.g. https://xxxx.supabase.co),
 * not the Vercel app URL. Otherwise getPublicUrl() produces links under your deployment
 * host and clicks return 404 from the Next app.
 */
export function validateSupabaseUrlForStorage(
  supabaseUrl: string | undefined
): { ok: true; url: string } | { ok: false; message: string } {
  if (supabaseUrl === undefined || supabaseUrl.trim() === "") {
    return {
      ok: false,
      message: "NEXT_PUBLIC_SUPABASE_URL is missing",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    return {
      ok: false,
      message: "NEXT_PUBLIC_SUPABASE_URL is not a valid absolute URL",
    };
  }
  if (parsed.hostname.endsWith(".vercel.app")) {
    return {
      ok: false,
      message:
        "NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL (https://<ref>.supabase.co), not your Vercel deployment URL",
    };
  }
  return { ok: true, url: supabaseUrl.replace(/\/$/, "") };
}

/**
 * Normalize href for UI: fix rows where file_url was saved with the wrong origin
 * (e.g. Vercel) but correct /storage/v1/... path, and resolve relative storage paths.
 */
export function resolveReportSourceFileUrl(fileUrl: string): string {
  const envBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const trimmed = fileUrl.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (
        envBase &&
        u.hostname.endsWith(".vercel.app") &&
        u.pathname.includes("/storage/v1/object/")
      ) {
        return new URL(u.pathname + u.search, envBase).href;
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("/")) {
    return envBase ? `${envBase}${trimmed}` : trimmed;
  }

  if (envBase) {
    return buildStoragePublicObjectUrl(envBase, REPORT_FILES_BUCKET, trimmed);
  }

  return trimmed;
}
