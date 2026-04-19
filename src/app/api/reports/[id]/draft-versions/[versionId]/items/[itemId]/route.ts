import { createClient } from "@/lib/supabase/server";
import { deleteReportManualNoteItem, updateDraftItem } from "@/lib/drafts/draft-service";
import type { DraftItemState } from "@/types/draft";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; versionId: string; itemId: string }>;
}

/**
 * PATCH /api/reports/[id]/draft-versions/[versionId]/items/[itemId]
 * Body: { state?, user_note?, display_text? } — display_text only for report REPORT_NOTES manual lines.
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

  const body = json as { state?: unknown; user_note?: unknown; display_text?: unknown };

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

  let display_text: string | undefined;
  if (body.display_text !== undefined) {
    if (typeof body.display_text !== "string") {
      return NextResponse.json({ error: "display_text must be a string" }, { status: 400 });
    }
    display_text = body.display_text;
  }

  const result = await updateDraftItem(supabase, reportId, versionId, itemId, user.id, {
    state,
    user_note,
    display_text,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ item: result.item });
}

/**
 * DELETE /api/reports/[id]/draft-versions/[versionId]/items/[itemId]
 * Report-level REPORT_NOTES manual notes only (active draft).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: reportId, versionId, itemId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteReportManualNoteItem(supabase, reportId, versionId, itemId, user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
