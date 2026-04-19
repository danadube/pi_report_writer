import { SUMMARY_SECTION_ORDER, type SummarySectionId } from "@/types/summary-candidates";

const MAX_SECTION = 80;
const MAX_ENTITY_KIND = 64;
const MAX_NOTE = 8000;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Minimal server-side shape for display_payload (seed + manual). */
export function validateDisplayPayload(input: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "display_payload must be a JSON object" };
  }
  const o = input as Record<string, unknown>;
  const sectionKey = o.section_key;
  const displayText = o.display_text;
  if (!isNonEmptyString(sectionKey) || sectionKey.length > MAX_SECTION) {
    return { ok: false, message: "display_payload.section_key is required (string)" };
  }
  if (!isNonEmptyString(displayText)) {
    return { ok: false, message: "display_payload.display_text is required (string)" };
  }
  return { ok: true, value: o };
}

export function isKnownSectionKey(key: string): key is SummarySectionId {
  return (SUMMARY_SECTION_ORDER as string[]).includes(key);
}

export function validateSectionKey(key: string): { ok: true } | { ok: false; message: string } {
  if (!isNonEmptyString(key) || key.length > MAX_SECTION) {
    return { ok: false, message: "section_key is invalid" };
  }
  if (!isKnownSectionKey(key)) {
    return { ok: false, message: `section_key must be one of: ${SUMMARY_SECTION_ORDER.join(", ")}` };
  }
  return { ok: true };
}

export function validateEntityKind(kind: string): { ok: true } | { ok: false; message: string } {
  if (!isNonEmptyString(kind) || kind.length > MAX_ENTITY_KIND) {
    return { ok: false, message: "entity_kind is invalid" };
  }
  return { ok: true };
}

export function validateUserNote(note: string | null | undefined): { ok: true; value: string | null } | { ok: false; message: string } {
  if (note == null || note === "") {
    return { ok: true, value: null };
  }
  if (typeof note !== "string") {
    return { ok: false, message: "user_note must be a string" };
  }
  if (note.length > MAX_NOTE) {
    return { ok: false, message: `user_note must be at most ${MAX_NOTE} characters` };
  }
  return { ok: true, value: note };
}

export function validateSourceRefPayload(input: unknown): { ok: true; value: Record<string, unknown> | null } | { ok: false; message: string } {
  if (input == null) {
    return { ok: true, value: null };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "source_ref_payload must be null or a JSON object" };
  }
  return { ok: true, value: input as Record<string, unknown> };
}
