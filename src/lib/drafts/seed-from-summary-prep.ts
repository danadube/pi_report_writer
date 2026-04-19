import { SUMMARY_SECTION_ORDER } from "@/types/summary-candidates";
import type { SummaryCandidate, SummaryPrepPayload } from "@/types/summary-candidates";

/**
 * Rows ready for insert into report_draft_items.
 * Seed uses the same *suggestions* as summary-prep (`selected_by_default`); durable rows do not
 * store ephemeral SummaryCandidate.id or extraction UUIDs — only display/source-ref snapshots.
 */
export interface DraftSeedItemRow {
  scope: "subject" | "report";
  subject_index: number | null;
  section_key: string;
  entity_kind: string;
  state: "included" | "excluded" | "review_needed";
  origin_type: "candidate";
  display_payload: Record<string, unknown>;
  source_ref_payload: Record<string, unknown> | null;
  sort_order: number;
}

/**
 * Maps summary-prep candidates to draft items: `selected_by_default` → included, else excluded.
 * Iteration order follows SUMMARY_SECTION_ORDER within each subject block for stable sort_order.
 */
export function buildDraftSeedRowsFromSummaryPrep(payload: SummaryPrepPayload): DraftSeedItemRow[] {
  const rows: DraftSeedItemRow[] = [];
  let sortOrder = 0;

  for (const block of payload.subject_blocks) {
    const subjectKey = block.subject_key;

    for (const sectionId of SUMMARY_SECTION_ORDER) {
      const sec = block.sections.find((s) => s.section === sectionId);
      if (!sec) continue;

      for (const c of sec.candidates) {
        rows.push(candidateToSeedRow(c, subjectKey, sortOrder));
        sortOrder += 1;
      }
    }
  }

  return rows;
}

function candidateToSeedRow(
  c: SummaryCandidate,
  blockSubjectKey: number,
  sortOrder: number
): DraftSeedItemRow {
  const state = c.selected_by_default ? "included" : "excluded";
  const subjectIndex = c.subject_index ?? blockSubjectKey;

  return {
    scope: "subject",
    subject_index: subjectIndex,
    section_key: c.section,
    entity_kind: c.entity_kind,
    state,
    origin_type: "candidate",
    display_payload: buildDisplayPayload(c),
    source_ref_payload: sourceRefJson(c),
    sort_order: sortOrder,
  };
}

/**
 * Snapshot fields for UI/provenance. Does not include ephemeral candidate.id or extraction entity_id.
 */
function buildDisplayPayload(c: SummaryCandidate): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    section_key: c.section,
    display_text: c.display_text,
  };
  if (c.label != null && c.label !== "") {
    payload.label = c.label;
  }
  if (c.ranking_score != null) {
    payload.ranking_score_hint = c.ranking_score;
  }
  return payload;
}

function sourceRefJson(c: SummaryCandidate): Record<string, unknown> | null {
  const ref = c.source_reference;
  if (!ref) return null;
  return {
    source_id: ref.source_id,
    file_name: ref.file_name,
  };
}
