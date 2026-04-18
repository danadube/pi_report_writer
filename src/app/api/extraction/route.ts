import { createClient } from "@/lib/supabase/server";
import { runExtractionForSource } from "@/lib/extraction/extraction-pipeline";
import { NextResponse } from "next/server";

/**
 * POST /api/extraction
 * Body: { sourceId: string, force?: boolean }
 * Re-runs PDF text extraction for a report_sources row (same logic as post-upload hook).
 * Use `force: true` to reprocess a source that already has extraction_status "complete"
 * (e.g. after parser updates). Without `force`, completed sources return "Already extracted".
 *
 * RLS: only sources belonging to the user's reports are visible/updatable.
 * We also verify `reports.created_by_user_id` so behavior stays correct if RLS is misconfigured.
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

  const body = json as { sourceId?: unknown; force?: unknown };
  if (typeof body.sourceId !== "string" || body.sourceId.length === 0) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }
  const force = body.force === true;

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

  const { data: ownedReport, error: ownedError } = await supabase
    .from("reports")
    .select("id")
    .eq("id", src.report_id)
    .eq("created_by_user_id", user.id)
    .maybeSingle();

  if (ownedError) {
    return NextResponse.json({ error: ownedError.message }, { status: 500 });
  }

  if (!ownedReport) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (src.extraction_status === "running") {
    return NextResponse.json(
      { error: "Extraction already in progress" },
      { status: 409 }
    );
  }

  if (src.extraction_status === "complete" && !force) {
    const { data: full, error: fullError } = await supabase
      .from("report_sources")
      .select("*")
      .eq("id", src.id)
      .maybeSingle();

    if (fullError) {
      return NextResponse.json({ error: fullError.message }, { status: 500 });
    }

    if (!full) {
      console.error(
        "[extraction] report_sources row missing when status=complete (id=%s)",
        src.id
      );
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Already extracted",
      source: full,
    });
  }

  let result: Awaited<ReturnType<typeof runExtractionForSource>>;
  try {
    result = await runExtractionForSource(supabase, {
      sourceId: src.id,
      reportId: src.report_id,
    });
  } catch (e) {
    console.error("[extraction] POST runExtractionForSource threw:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 500 }
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const { data: updated, error: reloadError } = await supabase
    .from("report_sources")
    .select("*")
    .eq("id", src.id)
    .maybeSingle();

  if (reloadError) {
    return NextResponse.json({ error: reloadError.message }, { status: 500 });
  }

  if (!updated) {
    console.error(
      "[extraction] report_sources row missing after successful run (id=%s)",
      src.id
    );
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ source: updated });
}
