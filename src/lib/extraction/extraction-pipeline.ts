import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  REPORT_FILES_BUCKET,
  storageObjectPathFromPublicUrl,
} from "@/lib/storage/report-files";
import { extractTextFromPdfBuffer, maybeTruncateExtractedText } from "@/lib/extraction/pdf-text";

type Supabase = SupabaseClient<Database>;

const EXTRACTION_ERROR_MAX_LEN = 5000;

async function markExtractionFailed(
  supabase: Supabase,
  sourceId: string,
  reportId: string,
  message: string
): Promise<void> {
  const trimmed =
    message.length > EXTRACTION_ERROR_MAX_LEN
      ? `${message.slice(0, EXTRACTION_ERROR_MAX_LEN)}…`
      : message;
  const { error } = await supabase
    .from("report_sources")
    .update({
      extraction_status: "failed",
      extraction_error: trimmed,
    })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (error) {
    console.error("[extraction] failed to persist extraction_error:", error.message);
  }
}

/**
 * Downloads the PDF from Supabase Storage, extracts plain text, and saves to
 * `report_sources.extracted_text` with `extraction_status` = complete, or failed on error.
 *
 * Callers should catch/log; upload route must not fail the HTTP response when this fails.
 *
 * TODO: Phase 3 — parseTloReport(rawText) and persist extracted_* tables.
 */
export async function runExtractionForSource(
  supabase: Supabase,
  params: {
    sourceId: string;
    reportId: string;
    /** If known (e.g. right after upload), avoids parsing file_url. */
    storageObjectPath?: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { sourceId, reportId, storageObjectPath: pathHint } = params;

  const { error: runningErr } = await supabase
    .from("report_sources")
    .update({ extraction_status: "running", extraction_error: null })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (runningErr) {
    return { ok: false, message: runningErr.message };
  }

  let objectPath: string | null = pathHint ?? null;

  if (!objectPath) {
    const { data: row, error: rowErr } = await supabase
      .from("report_sources")
      .select("file_url")
      .eq("id", sourceId)
      .eq("report_id", reportId)
      .maybeSingle();

    if (rowErr || !row) {
      const msg = rowErr?.message ?? "Source row not found";
      await markExtractionFailed(supabase, sourceId, reportId, msg);
      return { ok: false, message: msg };
    }

    objectPath = storageObjectPathFromPublicUrl(row.file_url, REPORT_FILES_BUCKET);
  }

  if (!objectPath) {
    const msg =
      "Could not resolve storage object path from file_url (check bucket and public URL format).";
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(REPORT_FILES_BUCKET)
    .download(objectPath);

  if (dlErr || !blob) {
    const msg = dlErr?.message ?? "Failed to download file from storage";
    console.error("[extraction] storage download:", msg);
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  let text: string;
  try {
    const buf = Buffer.from(await blob.arrayBuffer());
    text = await extractTextFromPdfBuffer(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF text extraction failed";
    console.error("[extraction] pdf parse:", e);
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    const msg =
      "No extractable text (image-only, scanned, or encrypted PDF, or empty document).";
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  const extractedText = maybeTruncateExtractedText(trimmed);

  const { error: completeErr } = await supabase
    .from("report_sources")
    .update({
      extraction_status: "complete",
      extraction_error: null,
      extracted_text: extractedText,
    })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (completeErr) {
    console.error("[extraction] persist extracted_text:", completeErr.message);
    await markExtractionFailed(supabase, sourceId, reportId, completeErr.message);
    return { ok: false, message: completeErr.message };
  }

  return { ok: true };
}
