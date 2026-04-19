import { createClient } from "@/lib/supabase/server";
import { addManualDraftItem } from "@/lib/drafts/draft-service";
import type { DraftItemScope, DraftItemState } from "@/types/draft";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

/**
 * POST /api/reports/[id]/draft-versions/[versionId]/items — add a manual draft line.
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = json as {
    section_key?: unknown;
    entity_kind?: unknown;
    display_payload?: unknown;
    source_ref_payload?: unknown;
    scope?: unknown;
    subject_index?: unknown;
    state?: unknown;
  };

  if (typeof body.section_key !== "string" || typeof body.entity_kind !== "string") {
    return NextResponse.json(
      { error: "section_key and entity_kind are required strings" },
      { status: 400 }
    );
  }

  const scope =
    body.scope === "report" || body.scope === "subject"
      ? (body.scope as DraftItemScope)
      : undefined;

  const state =
    body.state === "included" || body.state === "excluded" || body.state === "review_needed"
      ? (body.state as DraftItemState)
      : undefined;

  const subject_index =
    typeof body.subject_index === "number" && Number.isFinite(body.subject_index)
      ? body.subject_index
      : body.subject_index === null
        ? null
        : undefined;

  const result = await addManualDraftItem(supabase, reportId, versionId, user.id, {
    section_key: body.section_key,
    entity_kind: body.entity_kind,
    display_payload: body.display_payload,
    source_ref_payload: body.source_ref_payload,
    scope,
    subject_index,
    state,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ item: result.item });
}
