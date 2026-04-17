import { createClient } from "@/lib/supabase/server";
import { parseReportCreateBody } from "@/lib/reports/validation";
import { NextResponse } from "next/server";
import { ReportStatus, ReportType, type ReportListItem } from "@/types";

/**
 * GET /api/reports — list reports for the authenticated user (newest first).
 * POST /api/reports — create a report for the authenticated user.
 *
 * TODO: Organization-scoped listing when multi-user org workflows ship.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, report_type, status, case_name, subject_name, investigator_name, report_date, created_at, updated_at"
    )
    .eq("created_by_user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list: ReportListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    report_type: row.report_type as ReportType,
    status: row.status as ReportStatus,
    case_name: row.case_name,
    subject_name: row.subject_name,
    investigator_name: row.investigator_name,
    report_date: row.report_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return NextResponse.json(list);
}

export async function POST(request: Request) {
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

  const parsed = parseReportCreateBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const status = parsed.data.status ?? "DRAFT";

  const insert = {
    created_by_user_id: user.id,
    organization_id: profile?.organization_id ?? null,
    report_type: parsed.data.report_type,
    status: status as "DRAFT" | "FINAL" | "ARCHIVED",
    case_name: parsed.data.case_name ?? "",
    client_name: parsed.data.client_name ?? "",
    investigator_name: parsed.data.investigator_name ?? "",
    subject_name: parsed.data.subject_name ?? "",
    report_date: parsed.data.report_date ?? null,
    summary_notes: parsed.data.summary_notes ?? null,
  };

  const { data, error } = await supabase
    .from("reports")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
