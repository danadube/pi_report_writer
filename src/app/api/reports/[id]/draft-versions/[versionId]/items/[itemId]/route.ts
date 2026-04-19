import { createClient } from "@/lib/supabase/server";
import { updateDraftItem } from "@/lib/drafts/draft-service";
import type { DraftItemState } from "@/types/draft";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; versionId: string; itemId: string }>;
}

/**
 * PATCH /api/reports/[id]/draft-versions/[versionId]/items/[itemId]
 * Body: { state?: "included"|"excluded"|"review_needed", user_note?: string|null }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: reportId, versionId, itemId } = await params;
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

  const body = json as { state?: unknown; user_note?: unknown };

  let state: DraftItemState | undefined;
  if (body.state !== undefined) {
    if (body.state !== "included" && body.state !== "excluded" && body.state !== "review_needed") {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }
    state = body.state;
  }

  let user_note: string | null | undefined;
  if (body.user_note !== undefined) {
    if (body.user_note !== null && typeof body.user_note !== "string") {
      return NextResponse.json({ error: "user_note must be a string or null" }, { status: 400 });
    }
    user_note = body.user_note;
  }

  const result = await updateDraftItem(supabase, reportId, versionId, itemId, user.id, {
    state,
    user_note,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ item: result.item });
}
