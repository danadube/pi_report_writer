import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  fetchExtractedGroupedBySource,
  mergeSourcesWithExtracted,
} from "@/lib/reports/fetch-extracted-for-report";
import { buildSummaryPrepPayload } from "@/lib/summary/build-summary-candidates";
import type { ReportSource, SourceDocumentType } from "@/types";
import type { SummaryPrepPayload } from "@/types/summary-candidates";

type Supabase = SupabaseClient<Database>;

function mapSourceRow(row: {
  id: string;
  report_id: string;
  source_type: string;
  file_name: string;
  file_url: string;
  extracted_text: string | null;
  extraction_status?: string | null;
  extraction_error?: string | null;
  created_at: string;
}): ReportSource {
  return {
    id: row.id,
    report_id: row.report_id,
    source_type: row.source_type as SourceDocumentType,
    file_name: row.file_name,
    file_url: row.file_url,
    extracted_text: row.extracted_text,
    extraction_status: (row.extraction_status ?? "pending") as ReportSource["extraction_status"],
    extraction_error: row.extraction_error ?? null,
    created_at: row.created_at,
  };
}

/**
 * Builds the same summary-prep payload as GET /api/reports/[id]/summary-prep.
 * Caller should enforce auth/ownership; RLS still applies per table.
 */
export async function loadSummaryPrepPayloadForReport(
  supabase: Supabase,
  reportId: string
): Promise<{ ok: true; payload: SummaryPrepPayload } | { ok: false; message: string }> {
  const { data: sourceRows, error: sourcesError } = await supabase
    .from("report_sources")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });

  if (sourcesError) {
    return { ok: false, message: sourcesError.message };
  }

  const sources = (sourceRows ?? []).map((r) => mapSourceRow(r));

  const extracted = await fetchExtractedGroupedBySource(supabase, reportId);
  if (!extracted.ok) {
    return { ok: false, message: extracted.message };
  }

  const withExtracted = mergeSourcesWithExtracted(sources, extracted.bySource, reportId);
  const payload = buildSummaryPrepPayload(reportId, withExtracted);
  return { ok: true, payload };
}
