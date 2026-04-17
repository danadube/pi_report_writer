import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  REPORT_FILES_BUCKET,
  normalizeStorageObjectPath,
  resolveReportSourceFileUrl,
  storageObjectPathFromPublicUrl,
} from "@/lib/storage/report-files";
import {
  extractTextFromPdfBuffer,
  maybeTruncateExtractedText,
  MAX_EXTRACTED_CHARS,
  MAX_PDF_BYTES,
} from "@/lib/extraction/pdf-text";
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

  try {
    return await runExtractionInner(supabase, sourceId, reportId, pathHint);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Extraction failed (unexpected error)";
    console.error("[extraction] unhandled:", e);
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }
}

async function runExtractionInner(
  supabase: Supabase,
  sourceId: string,
  reportId: string,
  pathHint: string | undefined
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: runningErr } = await supabase
    .from("report_sources")
    .update({ extraction_status: "running", extraction_error: null })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (runningErr) {
    return { ok: false, message: runningErr.message };
  }

  let objectPath: string | null = null;

  const hintTrimmed = typeof pathHint === "string" ? pathHint.trim() : "";

  if (hintTrimmed.length > 0) {
    const normalized = normalizeStorageObjectPath(hintTrimmed);
    if (!normalized) {
      const msg =
        "Invalid storage path from upload (empty or unsafe path; must not contain '..').";
      await markExtractionFailed(supabase, sourceId, reportId, msg);
      return { ok: false, message: msg };
    }
    objectPath = normalized;
  }

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

    const rawUrl = typeof row.file_url === "string" ? row.file_url.trim() : "";
    if (!rawUrl) {
      const msg = "Source has no file_url; cannot download from storage.";
      await markExtractionFailed(supabase, sourceId, reportId, msg);
      return { ok: false, message: msg };
    }

    const resolved = resolveReportSourceFileUrl(rawUrl);
    objectPath = storageObjectPathFromPublicUrl(resolved, REPORT_FILES_BUCKET);
    if (!objectPath && /^https?:\/\//i.test(rawUrl)) {
      objectPath = storageObjectPathFromPublicUrl(rawUrl, REPORT_FILES_BUCKET);
    }
    if (!objectPath) {
      const msg =
        "Could not resolve storage object path from file_url (expected a Supabase public object URL for this project’s bucket, or a storage key under report-files).";
      await markExtractionFailed(supabase, sourceId, reportId, msg);
      return { ok: false, message: msg };
    }
    const validated = normalizeStorageObjectPath(objectPath);
    if (!validated) {
      const msg = "Resolved storage path is invalid.";
      await markExtractionFailed(supabase, sourceId, reportId, msg);
      return { ok: false, message: msg };
    }
    objectPath = validated;
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(REPORT_FILES_BUCKET)
    .download(objectPath);

  if (dlErr || !blob) {
    const msg =
      dlErr?.message ??
      "Failed to download file from storage (not found or access denied).";
    console.error("[extraction] storage download:", msg);
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  const arrayBuf = await blob.arrayBuffer();
  if (arrayBuf.byteLength === 0) {
    const msg = "Downloaded file is empty.";
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  if (arrayBuf.byteLength > MAX_PDF_BYTES) {
    const msg = `File is too large to extract on the server (max ${MAX_PDF_BYTES / (1024 * 1024)}MB).`;
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  let text: string;
  try {
    const buf = Buffer.from(arrayBuf);
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
      "No extractable text (image-only or scanned PDF, encrypted PDF, or empty document).";
    await markExtractionFailed(supabase, sourceId, reportId, msg);
    return { ok: false, message: msg };
  }

  const extractedText = maybeTruncateExtractedText(trimmed);
  const wasTruncated = trimmed.length > MAX_EXTRACTED_CHARS;

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
    const detail = wasTruncated
      ? `${msg} (Note: raw text was truncated to ${MAX_EXTRACTED_CHARS.toLocaleString()} characters.)`
      : msg;
    await markExtractionFailed(supabase, sourceId, reportId, detail);
    return { ok: false, message: detail };
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
    const detail = wasTruncated
      ? `${persisted.message} (Note: raw text was truncated to ${MAX_EXTRACTED_CHARS.toLocaleString()} characters.)`
      : persisted.message;
    await markExtractionFailed(supabase, sourceId, reportId, detail);
    return { ok: false, message: detail };
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
    const detail = `Extracted data was saved, but updating status to complete failed: ${doneErr.message}`;
    await markExtractionFailed(supabase, sourceId, reportId, detail);
    return { ok: false, message: detail };
  }

  return { ok: true };
}
