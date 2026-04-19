import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { buildDraftDocument } from "@/lib/drafts/build-draft-document";
import {
  describeCombinationRejection,
  isAllowedDraftItemCombination,
  MANUAL_ENTITY_KIND,
  SECTION_KEY_REPORT_NOTES,
  validateManualDraftSectionKey,
} from "@/lib/drafts/draft-item-registry";
import {
  validateManualNoteDisplayPayload,
  validateSeedDraftItemRow,
  validateSourceRefForManual,
} from "@/lib/drafts/draft-payload-validators";
import { ensureDraftVersionStaleConsistency } from "@/lib/drafts/draft-stale";
import { buildDraftSeedRowsFromSummaryPrep } from "@/lib/drafts/seed-from-summary-prep";
import { validateUserNote } from "@/lib/drafts/validate-draft-payload";
import { loadSummaryPrepPayloadForReport } from "@/lib/summary/load-summary-prep-payload";
import type { DraftDocument } from "@/types/draft-document";
import type {
  DraftItemOrigin,
  DraftItemScope,
  DraftItemState,
  DraftVersionStatus,
  DraftVersionWithItemsResponse,
  ReportDraftItemDTO,
  ReportDraftVersionDTO,
} from "@/types/draft";

type Supabase = SupabaseClient<Database>;

type DraftVersionRow = Database["public"]["Tables"]["report_draft_versions"]["Row"];
type DraftItemRow = Database["public"]["Tables"]["report_draft_items"]["Row"];

function toVersionDto(row: DraftVersionRow): ReportDraftVersionDTO {
  return {
    id: row.id,
    report_id: row.report_id,
    version_number: row.version_number,
    title: row.title,
    status: row.status as DraftVersionStatus,
    based_on_draft_version_id: row.based_on_draft_version_id,
    extraction_generation: Number(row.extraction_generation),
    has_blocking_warnings: row.has_blocking_warnings,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    finalized_at: row.finalized_at,
    stale_reason: row.stale_reason,
  };
}

function toItemDto(row: DraftItemRow): ReportDraftItemDTO {
  return {
    id: row.id,
    draft_version_id: row.draft_version_id,
    scope: row.scope as DraftItemScope,
    subject_index: row.subject_index,
    section_key: row.section_key,
    entity_kind: row.entity_kind,
    state: row.state as DraftItemState,
    origin_type: row.origin_type as DraftItemOrigin,
    display_payload: row.display_payload as Json,
    source_ref_payload: (row.source_ref_payload ?? null) as Json | null,
    sort_order: row.sort_order,
    review_reason: row.review_reason,
    user_note: row.user_note,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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

async function countDraftItemsForVersions(
  supabase: Supabase,
  versionIds: string[]
): Promise<Map<string, { review_needed_count: number; warning_count: number }>> {
  const map = new Map<string, { review_needed_count: number; warning_count: number }>();
  for (const id of versionIds) {
    map.set(id, { review_needed_count: 0, warning_count: 0 });
  }
  if (versionIds.length === 0) {
    return map;
  }

  const { data: rows, error } = await supabase
    .from("report_draft_items")
    .select("draft_version_id, state, origin_type")
    .in("draft_version_id", versionIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of rows ?? []) {
    const vid = row.draft_version_id as string;
    const cur = map.get(vid);
    if (!cur) continue;
    if (row.state === "review_needed") {
      cur.review_needed_count += 1;
    }
    if (row.origin_type === "system_warning") {
      cur.warning_count += 1;
    }
  }
  return map;
}

export async function listDraftVersionsForReport(
  supabase: Supabase,
  reportId: string,
  userId: string
): Promise<
  { ok: true; versions: ReportDraftVersionDTO[] } | { ok: false; status: number; message: string }
> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data, error } = await supabase
    .from("report_draft_versions")
    .select("*")
    .eq("report_id", reportId)
    .order("version_number", { ascending: false });

  if (error) {
    return { ok: false, status: 500, message: error.message };
  }

  const versions = (data ?? []).map(toVersionDto);
  const ids = versions.map((v) => v.id);

  let counts: Map<string, { review_needed_count: number; warning_count: number }>;
  try {
    counts = await countDraftItemsForVersions(supabase, ids);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Count failed";
    return { ok: false, status: 500, message: msg };
  }

  const withCounts: ReportDraftVersionDTO[] = versions.map((v) => {
    const c = counts.get(v.id) ?? { review_needed_count: 0, warning_count: 0 };
    return {
      ...v,
      review_needed_count: c.review_needed_count,
      warning_count: c.warning_count,
    };
  });

  return { ok: true, versions: withCounts };
}

export async function getDraftVersionWithItems(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  userId: string
): Promise<
  | { ok: true; body: DraftVersionWithItemsResponse }
  | { ok: false; status: number; message: string }
> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const stale = await ensureDraftVersionStaleConsistency(supabase, reportId, versionId, userId);
  if (!stale.ok) {
    return { ok: false, status: stale.status, message: stale.message };
  }

  const { data: ver, error: vErr } = await supabase
    .from("report_draft_versions")
    .select("*")
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (vErr) {
    return { ok: false, status: 500, message: vErr.message };
  }
  if (!ver) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }

  const { data: items, error: iErr } = await supabase
    .from("report_draft_items")
    .select("*")
    .eq("draft_version_id", versionId)
    .order("sort_order", { ascending: true });

  if (iErr) {
    return { ok: false, status: 500, message: iErr.message };
  }

  return {
    ok: true,
    body: {
      version: toVersionDto(ver),
      items: (items ?? []).map(toItemDto),
    },
  };
}

export async function getAssembledDraftDocument(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  userId: string
): Promise<{ ok: true; document: DraftDocument } | { ok: false; status: number; message: string }> {
  const loaded = await getDraftVersionWithItems(supabase, reportId, versionId, userId);
  if (!loaded.ok) {
    return { ok: false, status: loaded.status, message: loaded.message };
  }
  const doc = buildDraftDocument(reportId, loaded.body.version, loaded.body.items);
  return { ok: true, document: doc };
}

/**
 * Persists an assembled draft document snapshot and marks the version finalized (immutable).
 * Requires the active draft with no blocking warnings.
 */
export async function finalizeDraftVersion(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  userId: string
): Promise<
  | { ok: true; snapshotId: string; version: ReportDraftVersionDTO }
  | { ok: false; status: number; message: string }
> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: existingSnap, error: exSnapErr } = await supabase
    .from("report_final_snapshots")
    .select("id")
    .eq("draft_version_id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (exSnapErr) {
    return { ok: false, status: 500, message: exSnapErr.message };
  }
  if (existingSnap) {
    return { ok: false, status: 409, message: "This draft version is already finalized." };
  }

  const assembled = await getAssembledDraftDocument(supabase, reportId, versionId, userId);
  if (!assembled.ok) {
    return { ok: false, status: assembled.status, message: assembled.message };
  }

  const doc = assembled.document;
  if (doc.status !== "active") {
    return {
      ok: false,
      status: 409,
      message:
        doc.status === "finalized"
          ? "This draft version is already finalized."
          : "Only the active draft version can be finalized.",
    };
  }
  if (doc.blockingWarnings) {
    return {
      ok: false,
      status: 409,
      message: "Clear blocking warnings before finalizing this draft.",
    };
  }

  const snapshotPayload = doc as unknown as Json;

  const { data: inserted, error: insErr } = await supabase
    .from("report_final_snapshots")
    .insert({
      report_id: reportId,
      draft_version_id: versionId,
      snapshot_payload: snapshotPayload,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return { ok: false, status: 500, message: insErr?.message ?? "Could not finalize draft" };
  }

  const { data: updated, error: upErr } = await supabase
    .from("report_draft_versions")
    .update({
      status: "finalized",
      finalized_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .eq("report_id", reportId)
    .eq("status", "active")
    .select()
    .single();

  if (upErr || !updated) {
    await supabase.from("report_final_snapshots").delete().eq("id", inserted.id);
    return {
      ok: false,
      status: 409,
      message: upErr?.message ?? "Could not finalize draft (version may no longer be active).",
    };
  }

  await insertDraftEvent(supabase, {
    report_id: reportId,
    draft_version_id: versionId,
    draft_item_id: null,
    event_type: "draft_version_finalized",
    payload: { snapshot_id: inserted.id },
    created_by: userId,
  });

  return { ok: true, snapshotId: inserted.id, version: toVersionDto(updated) };
}

/** Returns the persisted final snapshot row for a finalized draft version (inspection / integrity). */
export async function getFinalSnapshotForDraftVersion(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  userId: string
): Promise<
  | { ok: true; snapshot: { id: string; snapshot_payload: Json; created_at: string } }
  | { ok: false; status: number; message: string }
> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: ver, error: vErr } = await supabase
    .from("report_draft_versions")
    .select("id, status")
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (vErr) {
    return { ok: false, status: 500, message: vErr.message };
  }
  if (!ver) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }
  if (ver.status !== "finalized") {
    return { ok: false, status: 404, message: "No final snapshot for this draft version" };
  }

  const { data: snap, error: sErr } = await supabase
    .from("report_final_snapshots")
    .select("id, snapshot_payload, created_at")
    .eq("draft_version_id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (sErr) {
    return { ok: false, status: 500, message: sErr.message };
  }
  if (!snap) {
    return { ok: false, status: 404, message: "Final snapshot not found" };
  }

  return {
    ok: true,
    snapshot: {
      id: snap.id,
      snapshot_payload: snap.snapshot_payload,
      created_at: snap.created_at,
    },
  };
}

async function insertDraftEvent(
  supabase: Supabase,
  row: Database["public"]["Tables"]["report_draft_events"]["Insert"]
): Promise<void> {
  const { error } = await supabase.from("report_draft_events").insert(row);
  if (error) {
    console.error("[drafts] insert event failed:", error.message);
  }
}

async function demoteActiveDrafts(
  supabase: Supabase,
  reportId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("report_draft_versions")
    .update({ status: "draft" })
    .eq("report_id", reportId)
    .eq("status", "active");

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function createDraftVersionFromSummaryPrep(
  supabase: Supabase,
  reportId: string,
  userId: string,
  options: { title?: string | null }
): Promise<
  | { ok: true; version: ReportDraftVersionDTO; item_count: number }
  | { ok: false; status: number; message: string }
> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: rep, error: repErr } = await supabase
    .from("reports")
    .select("extraction_generation")
    .eq("id", reportId)
    .single();

  if (repErr || !rep) {
    return { ok: false, status: 500, message: repErr?.message ?? "Report not found" };
  }

  const prep = await loadSummaryPrepPayloadForReport(supabase, reportId);
  if (!prep.ok) {
    return { ok: false, status: 500, message: prep.message };
  }

  const seedRows = buildDraftSeedRowsFromSummaryPrep(prep.payload);
  if (seedRows.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No summary candidates to seed; add sources and run extraction first.",
    };
  }

  for (const row of seedRows) {
    const v = validateSeedDraftItemRow(row);
    if (!v.ok) {
      return { ok: false, status: 400, message: v.message };
    }
  }

  const { data: maxRow, error: maxErr } = await supabase
    .from("report_draft_versions")
    .select("version_number")
    .eq("report_id", reportId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    return { ok: false, status: 500, message: maxErr.message };
  }

  const nextNum = (maxRow?.version_number ?? 0) + 1;
  const title =
    typeof options.title === "string" && options.title.trim()
      ? options.title.trim()
      : `Draft ${nextNum}`;

  const extractionGen = Number(rep.extraction_generation) || 1;

  const demoted = await demoteActiveDrafts(supabase, reportId);
  if (!demoted.ok) {
    return {
      ok: false,
      status: 500,
      message: `Could not demote existing active draft: ${demoted.message}`,
    };
  }

  const insertVersion: Database["public"]["Tables"]["report_draft_versions"]["Insert"] = {
    report_id: reportId,
    version_number: nextNum,
    title,
    status: "active",
    based_on_draft_version_id: null,
    extraction_generation: extractionGen,
    has_blocking_warnings: false,
    created_by: userId,
  };

  const { data: created, error: insErr } = await supabase
    .from("report_draft_versions")
    .insert(insertVersion)
    .select()
    .single();

  if (insErr || !created) {
    return { ok: false, status: 500, message: insErr?.message ?? "Insert failed" };
  }

  const itemInserts: Database["public"]["Tables"]["report_draft_items"]["Insert"][] = seedRows.map(
    (r) => ({
      draft_version_id: created.id,
      scope: r.scope,
      subject_index: r.subject_index,
      section_key: r.section_key,
      entity_kind: r.entity_kind,
      state: r.state,
      origin_type: r.origin_type,
      display_payload: r.display_payload as Json,
      source_ref_payload: r.source_ref_payload as Json | null,
      sort_order: r.sort_order,
      created_by: userId,
    })
  );

  const { error: itemsErr } = await supabase.from("report_draft_items").insert(itemInserts);

  if (itemsErr) {
    await supabase.from("report_draft_versions").delete().eq("id", created.id);
    return { ok: false, status: 500, message: itemsErr.message };
  }

  await insertDraftEvent(supabase, {
    report_id: reportId,
    draft_version_id: created.id,
    draft_item_id: null,
    event_type: "draft_version_created",
    payload: {
      seed: "summary_prep",
      version_number: nextNum,
      item_count: seedRows.length,
    },
    created_by: userId,
  });

  return { ok: true, version: toVersionDto(created), item_count: seedRows.length };
}

/**
 * Creates a new active draft version by copying items from an existing version.
 * Sets based_on_draft_version_id for lineage; uses current report extraction_generation.
 */
export async function branchDraftVersionFromVersion(
  supabase: Supabase,
  reportId: string,
  sourceVersionId: string,
  userId: string,
  options: { title?: string | null }
): Promise<
  | { ok: true; version: ReportDraftVersionDTO; item_count: number }
  | { ok: false; status: number; message: string }
> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: source, error: srcErr } = await supabase
    .from("report_draft_versions")
    .select("*")
    .eq("id", sourceVersionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (srcErr) {
    return { ok: false, status: 500, message: srcErr.message };
  }
  if (!source) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }
  if (source.status === "finalized") {
    return { ok: false, status: 409, message: "Cannot branch from a finalized draft version" };
  }

  const { data: rep, error: repErr } = await supabase
    .from("reports")
    .select("extraction_generation")
    .eq("id", reportId)
    .single();

  if (repErr || !rep) {
    return { ok: false, status: 500, message: repErr?.message ?? "Report not found" };
  }

  const { data: itemRows, error: itemsQErr } = await supabase
    .from("report_draft_items")
    .select("*")
    .eq("draft_version_id", sourceVersionId)
    .order("sort_order", { ascending: true });

  if (itemsQErr) {
    return { ok: false, status: 500, message: itemsQErr.message };
  }

  const { data: maxRow, error: maxErr } = await supabase
    .from("report_draft_versions")
    .select("version_number")
    .eq("report_id", reportId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    return { ok: false, status: 500, message: maxErr.message };
  }

  const nextNum = (maxRow?.version_number ?? 0) + 1;
  const title =
    typeof options.title === "string" && options.title.trim()
      ? options.title.trim()
      : `Branched from v${source.version_number}`;

  const extractionGen = Number(rep.extraction_generation) || 1;

  const demoted = await demoteActiveDrafts(supabase, reportId);
  if (!demoted.ok) {
    return {
      ok: false,
      status: 500,
      message: `Could not demote existing active draft: ${demoted.message}`,
    };
  }

  const insertVersion: Database["public"]["Tables"]["report_draft_versions"]["Insert"] = {
    report_id: reportId,
    version_number: nextNum,
    title,
    status: "active",
    based_on_draft_version_id: sourceVersionId,
    extraction_generation: extractionGen,
    has_blocking_warnings: false,
    stale_reason: null,
    created_by: userId,
  };

  const { data: created, error: insErr } = await supabase
    .from("report_draft_versions")
    .insert(insertVersion)
    .select()
    .single();

  if (insErr || !created) {
    return { ok: false, status: 500, message: insErr?.message ?? "Insert failed" };
  }

  const rows = itemRows ?? [];
  if (rows.length === 0) {
    await supabase.from("report_draft_versions").delete().eq("id", created.id);
    return {
      ok: false,
      status: 400,
      message: "Source draft has no items to copy.",
    };
  }

  const itemInserts: Database["public"]["Tables"]["report_draft_items"]["Insert"][] = rows.map(
    (row) => ({
      draft_version_id: created.id,
      scope: row.scope,
      subject_index: row.subject_index,
      section_key: row.section_key,
      entity_kind: row.entity_kind,
      state: row.state,
      origin_type: row.origin_type,
      display_payload: row.display_payload as Json,
      source_ref_payload: (row.source_ref_payload ?? null) as Json | null,
      sort_order: row.sort_order,
      review_reason: row.review_reason,
      user_note: row.user_note,
      created_by: userId,
    })
  );

  const { error: itemsErr } = await supabase.from("report_draft_items").insert(itemInserts);

  if (itemsErr) {
    await supabase.from("report_draft_versions").delete().eq("id", created.id);
    return { ok: false, status: 500, message: itemsErr.message };
  }

  await insertDraftEvent(supabase, {
    report_id: reportId,
    draft_version_id: created.id,
    draft_item_id: null,
    event_type: "draft_version_branched",
    payload: {
      from_draft_version_id: sourceVersionId,
      version_number: nextNum,
      item_count: rows.length,
    },
    created_by: userId,
  });

  return { ok: true, version: toVersionDto(created), item_count: rows.length };
}

/**
 * Makes a draft version active (demotes any other active version for the report).
 */
export async function activateDraftVersion(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  userId: string
): Promise<{ ok: true; version: ReportDraftVersionDTO } | { ok: false; status: number; message: string }> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: ver, error: vErr } = await supabase
    .from("report_draft_versions")
    .select("*")
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (vErr) {
    return { ok: false, status: 500, message: vErr.message };
  }
  if (!ver) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }
  if (ver.status === "finalized") {
    return { ok: false, status: 409, message: "Cannot activate a finalized draft version" };
  }
  if (ver.status === "archived") {
    return { ok: false, status: 409, message: "Cannot activate an archived draft version" };
  }

  const demoted = await demoteActiveDrafts(supabase, reportId);
  if (!demoted.ok) {
    return {
      ok: false,
      status: 500,
      message: `Could not demote existing active draft: ${demoted.message}`,
    };
  }

  const { data: updated, error: upErr } = await supabase
    .from("report_draft_versions")
    .update({ status: "active" })
    .eq("id", versionId)
    .eq("report_id", reportId)
    .select()
    .single();

  if (upErr || !updated) {
    return { ok: false, status: 500, message: upErr?.message ?? "Update failed" };
  }

  await insertDraftEvent(supabase, {
    report_id: reportId,
    draft_version_id: versionId,
    draft_item_id: null,
    event_type: "draft_version_activated",
    payload: { version_number: updated.version_number },
    created_by: userId,
  });

  return { ok: true, version: toVersionDto(updated) };
}

export async function addManualDraftItem(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  userId: string,
  body: {
    section_key: string;
    entity_kind: string;
    scope?: DraftItemScope;
    subject_index?: number | null;
    display_payload: unknown;
    source_ref_payload?: unknown;
    state?: DraftItemState;
  }
): Promise<{ ok: true; item: ReportDraftItemDTO } | { ok: false; status: number; message: string }> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: ver, error: vErr } = await supabase
    .from("report_draft_versions")
    .select("*")
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (vErr) {
    return { ok: false, status: 500, message: vErr.message };
  }
  if (!ver) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }
  if (ver.status === "finalized") {
    return { ok: false, status: 409, message: "Cannot modify a finalized draft version" };
  }
  if (ver.status !== "active") {
    return {
      ok: false,
      status: 403,
      message: "Only the active draft version can be edited.",
    };
  }

  if (body.entity_kind !== MANUAL_ENTITY_KIND) {
    return {
      ok: false,
      status: 400,
      message: `manual items must use entity_kind "${MANUAL_ENTITY_KIND}"`,
    };
  }

  const scope: DraftItemScope = body.scope ?? "subject";
  const sk = validateManualDraftSectionKey(body.section_key, scope);
  if (!sk.ok) {
    return { ok: false, status: 400, message: sk.message };
  }

  const comboShape = {
    scope,
    section_key: body.section_key,
    entity_kind: body.entity_kind,
    origin_type: "manual" as const,
  };
  if (!isAllowedDraftItemCombination(comboShape)) {
    return { ok: false, status: 400, message: describeCombinationRejection(comboShape) };
  }

  const base =
    body.display_payload != null &&
    typeof body.display_payload === "object" &&
    !Array.isArray(body.display_payload)
      ? { ...(body.display_payload as Record<string, unknown>) }
      : {};
  const mergedDisplay = { ...base, section_key: body.section_key };
  const disp = validateManualNoteDisplayPayload(mergedDisplay, body.section_key);
  if (!disp.ok) {
    return { ok: false, status: 400, message: disp.message };
  }

  const ref = validateSourceRefForManual(body.source_ref_payload ?? null);
  if (!ref.ok) {
    return { ok: false, status: 400, message: ref.message };
  }

  let subjectIndex: number | null = body.subject_index ?? null;
  if (scope === "subject") {
    if (subjectIndex == null || !Number.isFinite(subjectIndex)) {
      return { ok: false, status: 400, message: "subject_index is required when scope is subject" };
    }
  } else {
    subjectIndex = null;
  }

  const state: DraftItemState = body.state ?? "included";

  const { data: maxSort, error: sortErr } = await supabase
    .from("report_draft_items")
    .select("sort_order")
    .eq("draft_version_id", versionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sortErr) {
    return { ok: false, status: 500, message: sortErr.message };
  }
  const nextSort = (maxSort?.sort_order ?? -1) + 1;

  const insert: Database["public"]["Tables"]["report_draft_items"]["Insert"] = {
    draft_version_id: versionId,
    scope,
    subject_index: subjectIndex,
    section_key: body.section_key,
    entity_kind: body.entity_kind,
    state,
    origin_type: "manual",
    display_payload: disp.value as unknown as Json,
    source_ref_payload: ref.value as Json | null,
    sort_order: nextSort,
    created_by: userId,
  };

  const { data: row, error: insErr } = await supabase
    .from("report_draft_items")
    .insert(insert)
    .select()
    .single();

  if (insErr || !row) {
    return { ok: false, status: 500, message: insErr?.message ?? "Insert failed" };
  }

  await insertDraftEvent(supabase, {
    report_id: reportId,
    draft_version_id: versionId,
    draft_item_id: row.id,
    event_type: "draft_item_created",
    payload: { origin: "manual" },
    created_by: userId,
  });

  return { ok: true, item: toItemDto(row) };
}

export async function updateDraftItem(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  itemId: string,
  userId: string,
  patch: { state?: DraftItemState; user_note?: string | null; display_text?: string }
): Promise<{ ok: true; item: ReportDraftItemDTO } | { ok: false; status: number; message: string }> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: ver, error: vErr } = await supabase
    .from("report_draft_versions")
    .select("status")
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (vErr) {
    return { ok: false, status: 500, message: vErr.message };
  }
  if (!ver) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }
  if (ver.status === "finalized") {
    return { ok: false, status: 409, message: "Cannot modify a finalized draft version" };
  }
  if (ver.status !== "active") {
    return {
      ok: false,
      status: 403,
      message: "Only the active draft version can be edited.",
    };
  }

  const { data: existing, error: exErr } = await supabase
    .from("report_draft_items")
    .select("*")
    .eq("id", itemId)
    .eq("draft_version_id", versionId)
    .maybeSingle();

  if (exErr) {
    return { ok: false, status: 500, message: exErr.message };
  }
  if (!existing) {
    return { ok: false, status: 404, message: "Draft item not found" };
  }

  const update: Database["public"]["Tables"]["report_draft_items"]["Update"] = {};
  if (patch.state != null) {
    update.state = patch.state;
  }
  if (patch.user_note !== undefined) {
    const n = validateUserNote(patch.user_note);
    if (!n.ok) {
      return { ok: false, status: 400, message: n.message };
    }
    update.user_note = n.value;
  }
  if (patch.display_text !== undefined) {
    const isReportManual =
      existing.origin_type === "manual" &&
      existing.entity_kind === MANUAL_ENTITY_KIND &&
      existing.section_key === SECTION_KEY_REPORT_NOTES &&
      existing.scope === "report";
    if (!isReportManual) {
      return {
        ok: false,
        status: 400,
        message: "display_text can only be updated for report-level REPORT_NOTES manual notes.",
      };
    }
    if (typeof patch.display_text !== "string") {
      return { ok: false, status: 400, message: "display_text must be a string" };
    }
    const prev =
      existing.display_payload != null &&
      typeof existing.display_payload === "object" &&
      !Array.isArray(existing.display_payload)
        ? (existing.display_payload as Record<string, unknown>)
        : {};
    const merged = {
      ...prev,
      section_key: SECTION_KEY_REPORT_NOTES,
      display_text: patch.display_text.trim(),
    };
    const disp = validateManualNoteDisplayPayload(merged, SECTION_KEY_REPORT_NOTES);
    if (!disp.ok) {
      return { ok: false, status: 400, message: disp.message };
    }
    update.display_payload = disp.value as unknown as Json;
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, item: toItemDto(existing) };
  }

  const { data: row, error: upErr } = await supabase
    .from("report_draft_items")
    .update(update)
    .eq("id", itemId)
    .eq("draft_version_id", versionId)
    .select()
    .single();

  if (upErr || !row) {
    return { ok: false, status: 500, message: upErr?.message ?? "Update failed" };
  }

  await insertDraftEvent(supabase, {
    report_id: reportId,
    draft_version_id: versionId,
    draft_item_id: itemId,
    event_type: "draft_item_updated",
    payload: {
      fields: Object.keys(update),
      prior_state: existing.state,
      next_state: row.state,
    },
    created_by: userId,
  });

  return { ok: true, item: toItemDto(row) };
}

/**
 * Deletes a report-level REPORT_NOTES manual line (active draft only).
 */
export async function deleteReportManualNoteItem(
  supabase: Supabase,
  reportId: string,
  versionId: string,
  itemId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const gate = await assertOwnReport(supabase, reportId, userId);
  if (!gate.ok) {
    return { ok: false, status: gate.status, message: gate.message };
  }

  const { data: ver, error: vErr } = await supabase
    .from("report_draft_versions")
    .select("status")
    .eq("id", versionId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (vErr) {
    return { ok: false, status: 500, message: vErr.message };
  }
  if (!ver) {
    return { ok: false, status: 404, message: "Draft version not found" };
  }
  if (ver.status === "finalized") {
    return { ok: false, status: 409, message: "Cannot modify a finalized draft version" };
  }
  if (ver.status !== "active") {
    return {
      ok: false,
      status: 403,
      message: "Only the active draft version can be edited.",
    };
  }

  const { data: existing, error: exErr } = await supabase
    .from("report_draft_items")
    .select("*")
    .eq("id", itemId)
    .eq("draft_version_id", versionId)
    .maybeSingle();

  if (exErr) {
    return { ok: false, status: 500, message: exErr.message };
  }
  if (!existing) {
    return { ok: false, status: 404, message: "Draft item not found" };
  }

  const isReportManual =
    existing.origin_type === "manual" &&
    existing.entity_kind === MANUAL_ENTITY_KIND &&
    existing.section_key === SECTION_KEY_REPORT_NOTES &&
    existing.scope === "report";
  if (!isReportManual) {
    return {
      ok: false,
      status: 400,
      message: "Only report-level manual notes can be deleted with this endpoint.",
    };
  }

  const { error: delErr } = await supabase
    .from("report_draft_items")
    .delete()
    .eq("id", itemId)
    .eq("draft_version_id", versionId);

  if (delErr) {
    return { ok: false, status: 500, message: delErr.message };
  }

  await insertDraftEvent(supabase, {
    report_id: reportId,
    draft_version_id: versionId,
    draft_item_id: itemId,
    event_type: "draft_item_deleted",
    payload: { section_key: SECTION_KEY_REPORT_NOTES },
    created_by: userId,
  });

  return { ok: true };
}
