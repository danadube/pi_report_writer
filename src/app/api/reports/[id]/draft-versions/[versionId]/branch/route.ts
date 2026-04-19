import { createClient } from "@/lib/supabase/server";
import { branchDraftVersionFromVersion } from "@/lib/drafts/draft-service";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

/**
 * POST /api/reports/[id]/draft-versions/[versionId]/branch — copy items into a new active draft version.
 * Body: { title?: string }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: reportId, versionId } = await params;
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
  const body = json as { title?: unknown };
  const title = typeof body.title === "string" ? body.title : undefined;

  const result = await branchDraftVersionFromVersion(supabase, reportId, versionId, user.id, {
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
