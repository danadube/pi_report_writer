import { createClient } from "@/lib/supabase/server";
import {
  fetchExtractedGroupedBySource,
  mergeSourcesWithExtracted,
} from "@/lib/reports/fetch-extracted-for-report";
import { buildSummaryPrepPayload } from "@/lib/summary/build-summary-candidates";
import { NextResponse } from "next/server";
import type { ReportSource, SourceDocumentType } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
 * GET /api/reports/[id]/summary-prep — curated summary candidate lines derived from extracted_* rows.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("reports")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: sourceRows, error: sourcesError } = await supabase
    .from("report_sources")
    .select("*")
    .eq("report_id", id)
    .order("created_at", { ascending: false });

  if (sourcesError) {
    return NextResponse.json({ error: sourcesError.message }, { status: 500 });
  }

  const sources = (sourceRows ?? []).map((r) => mapSourceRow(r));

  const extracted = await fetchExtractedGroupedBySource(supabase, id);
  if (!extracted.ok) {
    return NextResponse.json({ error: extracted.message }, { status: 500 });
  }

  const withExtracted = mergeSourcesWithExtracted(sources, extracted.bySource, id);

  const payload = buildSummaryPrepPayload(id, withExtracted);
  return NextResponse.json(payload);
}
