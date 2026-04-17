import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

const PHASE1_STUB_ERROR =
  "Phase 1: PDF text extraction is not implemented yet. Next slice will add server-side PDF text extraction and TLO parsing.";

/**
 * Phase-1 stub: transitions pending → running → failed with a clear message.
 * Preserves upload success: callers should catch/log and not fail the HTTP upload.
 *
 * TODO: Replace stub with fetch PDF from Storage → extractTextFromPdf → parseTloReport → persist extracted_* rows.
 */
export async function runExtractionStubForSource(
  supabase: Supabase,
  sourceId: string,
  reportId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: runningErr } = await supabase
    .from("report_sources")
    .update({ extraction_status: "running", extraction_error: null })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (runningErr) {
    return { ok: false, message: runningErr.message };
  }

  const { error: failedErr } = await supabase
    .from("report_sources")
    .update({
      extraction_status: "failed",
      extraction_error: PHASE1_STUB_ERROR,
    })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (failedErr) {
    return { ok: false, message: failedErr.message };
  }

  return { ok: true };
}
