import { createClient } from "@/lib/supabase/server";
import { runExtractionForSource } from "@/lib/extraction/extraction-pipeline";
import { NextResponse } from "next/server";

/**
 * POST /api/extraction
 * Body: { sourceId: string }
 * Re-runs PDF text extraction for a report_sources row (same logic as post-upload hook).
 *
 * RLS: only sources belonging to the user's reports are visible/updatable.
 */
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

  const body = json as { sourceId?: unknown };
  if (typeof body.sourceId !== "string" || body.sourceId.length === 0) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const { data: src, error: fetchError } = await supabase
    .from("report_sources")
    .select("id, report_id, extraction_status")
    .eq("id", body.sourceId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!src) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (src.extraction_status === "running") {
    return NextResponse.json(
      { error: "Extraction already in progress" },
      { status: 409 }
    );
  }

  if (src.extraction_status === "complete") {
    const { data: full } = await supabase
      .from("report_sources")
      .select("*")
      .eq("id", src.id)
      .single();
    return NextResponse.json({
      message: "Already extracted",
      source: full,
    });
  }

  const result = await runExtractionForSource(supabase, {
    sourceId: src.id,
    reportId: src.report_id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const { data: updated, error: reloadError } = await supabase
    .from("report_sources")
    .select("*")
    .eq("id", src.id)
    .single();

  if (reloadError) {
    return NextResponse.json({ error: reloadError.message }, { status: 500 });
  }

  return NextResponse.json({ source: updated });
}
