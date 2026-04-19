import { getFinalSnapshotForDraftVersion } from "@/lib/drafts/draft-service";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

/**
 * GET /api/reports/[id]/draft-versions/[versionId]/final-snapshot — persisted snapshot payload for a finalized version.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: reportId, versionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getFinalSnapshotForDraftVersion(supabase, reportId, versionId, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({
    id: result.snapshot.id,
    created_at: result.snapshot.created_at,
    snapshot_payload: result.snapshot.snapshot_payload,
  });
}
