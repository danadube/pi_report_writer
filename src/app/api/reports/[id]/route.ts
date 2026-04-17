import { createClient } from "@/lib/supabase/server";
import { parseReportPatchBody } from "@/lib/reports/validation";
import type { Database } from "@/lib/supabase/database.types";
import { NextResponse } from "next/server";
import {
  ReportStatus,
  ReportType,
  SourceDocumentType,
  type Report,
  type ReportSource,
} from "@/types";
import {
  fetchExtractedGroupedBySource,
  mergeSourcesWithExtracted,
} from "@/lib/reports/fetch-extracted-for-report";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type ReportUpdate = Database["public"]["Tables"]["reports"]["Update"];

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

async function fetchSourcesForReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportId: string
): Promise<{ ok: true; sources: ReportSource[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("report_sources")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    sources: (data ?? []).map((row) => mapSourceRow(row)),
  };
}

async function attachExtractedRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportId: string,
  sources: ReportSource[]
): Promise<{ ok: true; sources: ReportSource[] } | { ok: false; message: string }> {
  const extracted = await fetchExtractedGroupedBySource(supabase, reportId);
  if (!extracted.ok) {
    return extracted;
  }
  return {
    ok: true,
    sources: mergeSourcesWithExtracted(sources, extracted.bySource),
  };
}

/**
 * GET /api/reports/[id] — single report with related sources.
 * PATCH /api/reports/[id] — update report fields (owner only via RLS).
 *
 * TODO: DELETE — soft-delete (status ARCHIVED) or hard delete per product rules.
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
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourcesResult = await fetchSourcesForReport(supabase, row.id);
  if (!sourcesResult.ok) {
    return NextResponse.json({ error: sourcesResult.message }, { status: 500 });
  }
  const withExtracted = await attachExtractedRows(supabase, row.id, sourcesResult.sources);
  if (!withExtracted.ok) {
    return NextResponse.json({ error: withExtracted.message }, { status: 500 });
  }
  const sources = withExtracted.sources;

  const report: Report = {
    id: row.id,
    organization_id: row.organization_id,
    created_by_user_id: row.created_by_user_id,
    report_type: row.report_type as ReportType,
    status: row.status as ReportStatus,
    case_name: row.case_name,
    client_name: row.client_name,
    investigator_name: row.investigator_name,
    subject_name: row.subject_name,
    report_date: row.report_date,
    summary_notes: row.summary_notes,
    generated_report_html: row.generated_report_html,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sources,
  };

  return NextResponse.json(report);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseReportPatchBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const update: ReportUpdate = {};
  const d = parsed.data;
  if (d.report_type !== undefined) update.report_type = d.report_type;
  if (d.status !== undefined) update.status = d.status;
  if (d.case_name !== undefined) update.case_name = d.case_name;
  if (d.client_name !== undefined) update.client_name = d.client_name;
  if (d.investigator_name !== undefined) {
    update.investigator_name = d.investigator_name;
  }
  if (d.subject_name !== undefined) update.subject_name = d.subject_name;
  if (d.report_date !== undefined) update.report_date = d.report_date;
  if (d.summary_notes !== undefined) update.summary_notes = d.summary_notes;
  if (d.generated_report_html !== undefined) {
    update.generated_report_html = d.generated_report_html;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updatedRow, error } = await supabase
    .from("reports")
    .update(update)
    .eq("id", id)
    .eq("created_by_user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!updatedRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourcesResult = await fetchSourcesForReport(supabase, updatedRow.id);
  if (!sourcesResult.ok) {
    return NextResponse.json({ error: sourcesResult.message }, { status: 500 });
  }
  const withExtracted = await attachExtractedRows(
    supabase,
    updatedRow.id,
    sourcesResult.sources
  );
  if (!withExtracted.ok) {
    return NextResponse.json({ error: withExtracted.message }, { status: 500 });
  }
  const sources = withExtracted.sources;

  const report: Report = {
    id: updatedRow.id,
    organization_id: updatedRow.organization_id,
    created_by_user_id: updatedRow.created_by_user_id,
    report_type: updatedRow.report_type as ReportType,
    status: updatedRow.status as ReportStatus,
    case_name: updatedRow.case_name,
    client_name: updatedRow.client_name,
    investigator_name: updatedRow.investigator_name,
    subject_name: updatedRow.subject_name,
    report_date: updatedRow.report_date,
    summary_notes: updatedRow.summary_notes,
    generated_report_html: updatedRow.generated_report_html,
    created_at: updatedRow.created_at,
    updated_at: updatedRow.updated_at,
    sources,
  };

  return NextResponse.json(report);
}
