import { createClient } from "@/lib/supabase/server";
import {
  createDraftVersionFromSummaryPrep,
  listDraftVersionsForReport,
} from "@/lib/drafts/draft-service";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reports/[id]/draft-versions — list draft versions (newest version_number first).
 * POST — create a draft version seeded from current summary-prep output.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: reportId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listDraftVersionsForReport(supabase, reportId, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ versions: result.versions });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: reportId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const body = json as { title?: unknown; seedFromSummaryPrep?: unknown };
  const title = typeof body.title === "string" ? body.title : undefined;
  const seedFromSummaryPrep = body.seedFromSummaryPrep !== false;

  if (!seedFromSummaryPrep) {
    return NextResponse.json(
      { error: "Only seedFromSummaryPrep: true is supported in this phase" },
      { status: 400 }
    );
  }

  const result = await createDraftVersionFromSummaryPrep(supabase, reportId, user.id, {
    title,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({
    version: result.version,
    item_count: result.item_count,
  });
}
