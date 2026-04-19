import { createClient } from "@/lib/supabase/server";
import { activateDraftVersion } from "@/lib/drafts/draft-service";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

/**
 * POST /api/reports/[id]/draft-versions/[versionId]/activate — set this version as the active draft.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id: reportId, versionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await activateDraftVersion(supabase, reportId, versionId, user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ version: result.version });
}
