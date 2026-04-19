import { createClient } from "@/lib/supabase/server";
import { loadSummaryPrepPayloadForReport } from "@/lib/summary/load-summary-prep-payload";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
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

  const prep = await loadSummaryPrepPayloadForReport(supabase, id);
  if (!prep.ok) {
    return NextResponse.json({ error: prep.message }, { status: 500 });
  }

  return NextResponse.json(prep.payload);
}
