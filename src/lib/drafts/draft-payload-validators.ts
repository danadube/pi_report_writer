import {
  describeCombinationRejection,
  isAllowedDraftItemCombination,
  isContentSectionKey,
  SECTION_KEY_SYSTEM_WARNINGS,
  type DraftItemOriginType,
} from "@/lib/drafts/draft-item-registry";
import { ADDRESS_PAYLOAD_FORMAT_SPLIT_V1 } from "@/lib/drafts/legacy-address-draft";
import type { SummarySectionId } from "@/types/summary-candidates";

const MAX_TEXT = 16000;
const MAX_LABEL = 500;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** source_ref for seeded candidates: optional source_id + file_name. */
export function validateCandidateSourceRef(
  input: unknown
): { ok: true; value: Record<string, unknown> | null } | { ok: false; message: string } {
  if (input == null) {
    return { ok: true, value: null };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "source_ref_payload must be null or an object" };
  }
  const o = input as Record<string, unknown>;
  if (o.source_id != null && typeof o.source_id !== "string") {
    return { ok: false, message: "source_ref_payload.source_id must be a string or null" };
  }
  if (o.file_name != null && typeof o.file_name !== "string") {
    return { ok: false, message: "source_ref_payload.file_name must be a string or null" };
  }
  return { ok: true, value: o };
}

/**
 * Seeded candidate snapshot: section_key, display_text, optional label, optional ranking_score_hint.
 */
export function validateCandidateSeedDisplayPayload(
  input: unknown,
  expectedSection: SummarySectionId
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "display_payload must be a JSON object" };
  }
  const o = input as Record<string, unknown>;
  if (o.section_key !== expectedSection) {
    return { ok: false, message: "display_payload.section_key must match item section_key" };
  }
  if (!isNonEmptyString(o.display_text) || String(o.display_text).length > MAX_TEXT) {
    return { ok: false, message: "display_payload.display_text is required" };
  }
  if (o.label != null && (typeof o.label !== "string" || o.label.length > MAX_LABEL)) {
    return { ok: false, message: "display_payload.label must be a short string or omitted" };
  }
  if (
    o.ranking_score_hint != null &&
    (typeof o.ranking_score_hint !== "number" || !Number.isFinite(o.ranking_score_hint))
  ) {
    return { ok: false, message: "display_payload.ranking_score_hint must be a finite number or omitted" };
  }
  if (o.address_date_metadata != null) {
    if (typeof o.address_date_metadata !== "string" || o.address_date_metadata.length > 500) {
      return {
        ok: false,
        message: "display_payload.address_date_metadata must be a short string or omitted",
      };
    }
  }
  if (o.address_payload_format != null) {
    if (o.address_payload_format !== ADDRESS_PAYLOAD_FORMAT_SPLIT_V1) {
      return {
        ok: false,
        message: `display_payload.address_payload_format must be "${ADDRESS_PAYLOAD_FORMAT_SPLIT_V1}" or omitted`,
      };
    }
  }
  const allowed = new Set([
    "section_key",
    "display_text",
    "label",
    "ranking_score_hint",
    "address_date_metadata",
    "address_payload_format",
  ]);
  for (const k of Object.keys(o)) {
    if (!allowed.has(k)) {
      return { ok: false, message: `display_payload: unexpected field "${k}" for candidate seed` };
    }
  }
  return { ok: true, value: o };
}

/**
 * Manual note: section_key, display_text, optional label (editorial only).
 */
export function validateManualNoteDisplayPayload(
  input: unknown,
  expectedSection: string
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "display_payload must be a JSON object" };
  }
  const o = input as Record<string, unknown>;
  if (o.section_key !== expectedSection) {
    return { ok: false, message: "display_payload.section_key must match item section_key" };
  }
  if (!isNonEmptyString(o.display_text) || String(o.display_text).length > MAX_TEXT) {
    return { ok: false, message: "display_payload.display_text is required for manual_note" };
  }
  if (o.label != null && (typeof o.label !== "string" || o.label.length > MAX_LABEL)) {
    return { ok: false, message: "display_payload.label must be a short string or omitted" };
  }
  const allowed = new Set(["section_key", "display_text", "label"]);
  for (const k of Object.keys(o)) {
    if (!allowed.has(k)) {
      return { ok: false, message: `display_payload: unexpected field "${k}" for manual_note` };
    }
  }
  return { ok: true, value: o };
}

const STALE_WARNING_CODE = "stale_extraction" as const;

/**
 * System warning payload for stale extraction drift.
 */
export function validateStaleWarningDisplayPayload(
  input: unknown
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "display_payload must be a JSON object" };
  }
  const o = input as Record<string, unknown>;
  if (o.section_key !== SECTION_KEY_SYSTEM_WARNINGS) {
    return { ok: false, message: "display_payload.section_key must be SYSTEM_WARNINGS" };
  }
  if (!isNonEmptyString(o.display_text)) {
    return { ok: false, message: "display_payload.display_text is required" };
  }
  if (o.warning_code !== STALE_WARNING_CODE) {
    return { ok: false, message: "display_payload.warning_code must be stale_extraction" };
  }
  if (o.report_extraction_generation == null || typeof o.report_extraction_generation !== "number") {
    return { ok: false, message: "display_payload.report_extraction_generation is required" };
  }
  if (o.draft_snapshot_generation == null || typeof o.draft_snapshot_generation !== "number") {
    return { ok: false, message: "display_payload.draft_snapshot_generation is required" };
  }
  const allowed = new Set([
    "section_key",
    "display_text",
    "warning_code",
    "report_extraction_generation",
    "draft_snapshot_generation",
  ]);
  for (const k of Object.keys(o)) {
    if (!allowed.has(k)) {
      return { ok: false, message: `display_payload: unexpected field "${k}" for system warning` };
    }
  }
  return { ok: true, value: o };
}

export function validateSourceRefForManual(
  input: unknown
): { ok: true; value: Record<string, unknown> | null } | { ok: false; message: string } {
  if (input == null) {
    return { ok: true, value: null };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "source_ref_payload must be null or an object" };
  }
  return { ok: true, value: input as Record<string, unknown> };
}

/** Validate a full draft item row for insert (seed path). */
export function validateSeedDraftItemRow(row: {
  scope: "subject" | "report";
  subject_index: number | null;
  section_key: string;
  entity_kind: string;
  origin_type: DraftItemOriginType;
  display_payload: Record<string, unknown>;
  source_ref_payload: Record<string, unknown> | null;
}): { ok: true } | { ok: false; message: string } {
  const shape = {
    scope: row.scope,
    section_key: row.section_key,
    entity_kind: row.entity_kind,
    origin_type: row.origin_type,
  };
  if (!isAllowedDraftItemCombination(shape)) {
    return { ok: false, message: describeCombinationRejection(shape) };
  }
  if (row.origin_type === "candidate") {
    if (row.scope !== "subject" || row.subject_index == null) {
      return { ok: false, message: "candidate items must be subject-scoped with subject_index" };
    }
    if (!isContentSectionKey(row.section_key)) {
      return { ok: false, message: "candidate section_key must be a content section" };
    }
    const vd = validateCandidateSeedDisplayPayload(row.display_payload, row.section_key);
    if (!vd.ok) {
      return { ok: false, message: vd.message };
    }
    const sr = validateCandidateSourceRef(row.source_ref_payload);
    if (!sr.ok) {
      return { ok: false, message: sr.message };
    }
  }
  return { ok: true };
}
