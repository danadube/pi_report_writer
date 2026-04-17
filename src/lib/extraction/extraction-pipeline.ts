import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  REPORT_FILES_BUCKET,
  storageObjectPathFromPublicUrl,
} from "@/lib/storage/report-files";
import { extractTextFromPdfBuffer, maybeTruncateExtractedText } from "@/lib/extraction/pdf-text";
import { parseTlo } from "@/lib/extraction/parsers/tlo-parser";
import { replaceExtractedDataForSource } from "@/lib/extraction/persist-extracted";
import type { ExtractedData } from "@/types";

type Supabase = SupabaseClient<Database>;

const EMPTY_EXTRACTED: ExtractedData = {
  people: [],
  addresses: [],
  phones: [],
  vehicles: [],
  associates: [],
  employment: [],
};

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
 * Downloads the PDF from Supabase Storage, extracts plain text, parses TLO-style
 * entities, persists to extracted_* tables, then marks `extraction_status` complete.
 *
 * Callers should catch/log; upload route must not fail the HTTP response when this fails.
 */
export async function runExtractionForSource(
  supabase: Supabase,
  params: {
    sourceId: string;
    reportId: string;
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

  const { error: textSaveErr } = await supabase
    .from("report_sources")
    .update({
      extracted_text: extractedText,
      extraction_status: "running",
      extraction_error: null,
    })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (textSaveErr) {
    console.error("[extraction] persist extracted_text:", textSaveErr.message);
    await markExtractionFailed(supabase, sourceId, reportId, textSaveErr.message);
    return { ok: false, message: textSaveErr.message };
  }

  let structured: ExtractedData;
  try {
    structured = parseTlo(extractedText);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Structured parse failed (unexpected error)";
    console.error("[extraction] parseTlo:", e);
    await replaceExtractedDataForSource(supabase, reportId, sourceId, EMPTY_EXTRACTED);
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  const persisted = await replaceExtractedDataForSource(
    supabase,
    reportId,
    sourceId,
    structured
  );
  if (!persisted.ok) {
    console.error("[extraction] persist structured:", persisted.message);
    await replaceExtractedDataForSource(supabase, reportId, sourceId, EMPTY_EXTRACTED);
    await markExtractionFailed(supabase, sourceId, reportId, persisted.message);
    return { ok: false, message: persisted.message };
  }

  const { error: doneErr } = await supabase
    .from("report_sources")
    .update({
      extraction_status: "complete",
      extraction_error: null,
    })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (doneErr) {
    await markExtractionFailed(supabase, sourceId, reportId, doneErr.message);
    return { ok: false, message: doneErr.message };
  }

  return { ok: true };
}
