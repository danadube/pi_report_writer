import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  SECTION_KEY_SYSTEM_WARNINGS,
  SYSTEM_WARNING_ENTITY_KINDS,
} from "@/lib/drafts/draft-item-registry";
import { validateStaleWarningDisplayPayload } from "@/lib/drafts/draft-payload-validators";

type Supabase = SupabaseClient<Database>;

async function assertOwnReport(
  supabase: Supabase,
  reportId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: 404 | 500; message: string }> {
  const { data, error } = await supabase
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("created_by_user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, message: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, message: "Not found" };
  }
  return { ok: true };
}

function staleDisplayPayload(reportGen: number, draftGen: number): Record<string, unknown> {
  return {
    section_key: SECTION_KEY_SYSTEM_WARNINGS,
    warning_code: "stale_extraction",
    report_extraction_generation: reportGen,
    draft_snapshot_generation: draftGen,
    display_text:
      `Report extraction has changed since this draft was created (snapshot generation ${draftGen}, current ${reportGen}). Review sources and draft lines before relying on this version.`,
  };
}

/**
 * If the report's extraction generation has moved past the draft's snapshot, marks the version stale,
 * sets blocking warnings, and ensures a single report-level system_warning item exists (idempotent).
 */
export async function ensureDraftVersionStaleConsistency(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  userId: string
): Promise<{ ok: true; mutated: boolean } | { ok: false; status: number; message: string }> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: reportRow, error: repErr } = await supabase
    .from("reports")
    .select("extraction_generation")
    .eq("id", reportId)
    .single();

  if (repErr || !reportRow) {
    return { ok: false, status: 500, message: repErr?.message ?? "Report not found" };
  }

  const { data: version, error: vErr } = await supabase
    .from("report_draft_versions")
    .select("*")
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (vErr) {
    return { ok: false, status: 500, message: vErr.message };
  }
  if (!version) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }

  const versionStatus = version.status;
  if (versionStatus === "finalized" || versionStatus === "archived") {
    return { ok: true, mutated: false };
  }

  const reportGen = Number(reportRow.extraction_generation) || 1;
  const draftGen = Number(version.extraction_generation) || 1;

  if (reportGen === draftGen) {
    return { ok: true, mutated: false };
  }

  let mutated = false;
  const staleReason = `Extraction generation advanced (draft snapshot ${draftGen}, report now ${reportGen}).`;
  const wasAlreadyStale = versionStatus === "stale";

  const { error: upVerErr } = await supabase
    .from("report_draft_versions")
    .update({
      status: "stale",
      stale_reason: staleReason,
      has_blocking_warnings: true,
    })
    .eq("id", versionId)
    .eq("report_id", reportId)
    .in("status", ["draft", "active", "stale"]);

  if (upVerErr) {
    return { ok: false, status: 500, message: upVerErr.message };
  }
  mutated = true;

  if (!wasAlreadyStale) {
    const { error: evErr } = await supabase.from("report_draft_events").insert({
      report_id: reportId,
      draft_version_id: versionId,
      draft_item_id: null,
      event_type: "draft_marked_stale",
      payload: {
        report_extraction_generation: reportGen,
        draft_snapshot_generation: draftGen,
      },
      created_by: userId,
    });
    if (evErr) {
      console.error("[drafts] draft_marked_stale event failed:", evErr.message);
    }
  }

  const { data: existing, error: exErr } = await supabase
    .from("report_draft_items")
    .select("id")
    .eq("draft_version_id", versionId)
    .eq("origin_type", "system_warning")
    .eq("entity_kind", SYSTEM_WARNING_ENTITY_KINDS.stale_extraction)
    .eq("section_key", SECTION_KEY_SYSTEM_WARNINGS)
    .maybeSingle();

  if (exErr) {
    return { ok: false, status: 500, message: exErr.message };
  }

  const payloadRaw = staleDisplayPayload(reportGen, draftGen);
  const validated = validateStaleWarningDisplayPayload(payloadRaw);
  if (!validated.ok) {
    return { ok: false, status: 500, message: validated.message };
  }

  if (existing) {
    const { error: upItemErr } = await supabase
      .from("report_draft_items")
      .update({
        display_payload: validated.value as Json,
        state: "review_needed",
      })
      .eq("id", existing.id);

    if (upItemErr) {
      return { ok: false, status: 500, message: upItemErr.message };
    }
  } else {
    const { data: minSortRow } = await supabase
      .from("report_draft_items")
      .select("sort_order")
      .eq("draft_version_id", versionId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    const nextSort = (minSortRow?.sort_order ?? 1) - 1;

    const insert: Database["public"]["Tables"]["report_draft_items"]["Insert"] = {
      draft_version_id: versionId,
      scope: "report",
      subject_index: null,
      section_key: SECTION_KEY_SYSTEM_WARNINGS,
      entity_kind: SYSTEM_WARNING_ENTITY_KINDS.stale_extraction,
      state: "review_needed",
      origin_type: "system_warning",
      display_payload: validated.value as Json,
      source_ref_payload: null,
      sort_order: nextSort,
      created_by: userId,
    };

    const { error: insErr } = await supabase.from("report_draft_items").insert(insert);
    if (insErr) {
      return { ok: false, status: 500, message: insErr.message };
    }

    const { error: warnEvErr } = await supabase.from("report_draft_events").insert({
      report_id: reportId,
      draft_version_id: versionId,
      draft_item_id: null,
      event_type: "draft_stale_warning_created",
      payload: { section_key: SECTION_KEY_SYSTEM_WARNINGS },
      created_by: userId,
    });
    if (warnEvErr) {
      console.error("[drafts] draft_stale_warning_created event failed:", warnEvErr.message);
    }
  }

  return { ok: true, mutated };
}
