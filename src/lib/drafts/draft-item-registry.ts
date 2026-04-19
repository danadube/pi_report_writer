import { SUMMARY_SECTION_ORDER, SUMMARY_SECTION_LABELS, type SummarySectionId } from "@/types/summary-candidates";

/** Report-level system sections (not subject summary sections). */
export const SECTION_KEY_SYSTEM_WARNINGS = "SYSTEM_WARNINGS" as const;

/** Report-scoped manual editorial notes (not system warnings). */
export const SECTION_KEY_REPORT_NOTES = "REPORT_NOTES" as const;

/** Report-level section keys (warnings, notes — not subject summary columns). */
export const REPORT_LEVEL_SECTION_KEYS = [
  SECTION_KEY_SYSTEM_WARNINGS,
  SECTION_KEY_REPORT_NOTES,
] as const;

export type ReportLevelSectionKey = (typeof REPORT_LEVEL_SECTION_KEYS)[number];

/** @deprecated Use REPORT_LEVEL_SECTION_KEYS; kept for older references. */
export const REPORT_SYSTEM_SECTION_KEYS = [SECTION_KEY_SYSTEM_WARNINGS] as const;

export type ReportSystemSectionKey = (typeof REPORT_SYSTEM_SECTION_KEYS)[number];

/** All section keys allowed in draft items (content + report-level). */
export const ALL_DRAFT_SECTION_KEYS: string[] = [
  ...SUMMARY_SECTION_ORDER,
  ...REPORT_LEVEL_SECTION_KEYS,
];

export function isContentSectionKey(key: string): key is SummarySectionId {
  return (SUMMARY_SECTION_ORDER as string[]).includes(key);
}

export function isReportSystemSectionKey(key: string): key is ReportSystemSectionKey {
  return (REPORT_SYSTEM_SECTION_KEYS as readonly string[]).includes(key);
}

export function isReportLevelSectionKey(key: string): key is ReportLevelSectionKey {
  return (REPORT_LEVEL_SECTION_KEYS as readonly string[]).includes(key);
}

/** Entity kinds produced by summary-prep seeding (candidate origin, subject scope). */
export const CANDIDATE_ENTITY_KINDS_BY_SECTION: Record<SummarySectionId, readonly string[]> = {
  SUBJECT_IDENTITY: ["person"],
  ALIASES: ["alias"],
  DOB_SSN_DL: ["dob", "ssn", "dl"],
  CURRENT_ADDRESS: ["address"],
  PRIOR_ADDRESSES: ["address"],
  PHONES: ["phone"],
  EMAILS: ["email"],
  ASSOCIATES_RELATIVES: ["associate"],
  EMPLOYMENT: ["employment"],
  VEHICLES: ["vehicle"],
} as const;

/** Manual editorial lines (manual origin). */
export const MANUAL_ENTITY_KIND = "manual_note" as const;

/** System-generated warnings (system_warning origin, report scope). */
export const SYSTEM_WARNING_ENTITY_KINDS = {
  stale_extraction: "stale_extraction",
} as const;

export type DraftItemOriginType = "candidate" | "manual" | "system_warning";

export interface DraftItemShape {
  scope: "subject" | "report";
  section_key: string;
  entity_kind: string;
  origin_type: DraftItemOriginType;
}

/**
 * Returns whether the section / entity_kind / origin / scope combination is allowed.
 */
export function isAllowedDraftItemCombination(shape: DraftItemShape): boolean {
  const { scope, section_key, entity_kind, origin_type } = shape;

  if (origin_type === "system_warning") {
    if (scope !== "report") return false;
    if (section_key !== SECTION_KEY_SYSTEM_WARNINGS) return false;
    if (entity_kind !== SYSTEM_WARNING_ENTITY_KINDS.stale_extraction) return false;
    return true;
  }

  if (origin_type === "manual") {
    if (entity_kind !== MANUAL_ENTITY_KIND) return false;
    if (scope === "report") {
      return section_key === SECTION_KEY_REPORT_NOTES;
    }
    if (scope === "subject") {
      return isContentSectionKey(section_key);
    }
    return false;
  }

  if (origin_type === "candidate") {
    if (scope !== "subject") return false;
    if (!isContentSectionKey(section_key)) return false;
    const allowed = CANDIDATE_ENTITY_KINDS_BY_SECTION[section_key as SummarySectionId];
    return allowed.includes(entity_kind);
  }

  return false;
}

export function describeCombinationRejection(shape: DraftItemShape): string {
  return `Invalid draft item: scope=${shape.scope} section_key=${shape.section_key} entity_kind=${shape.entity_kind} origin_type=${shape.origin_type}`;
}

export function validateManualDraftSectionKey(
  sectionKey: string,
  scope: "subject" | "report"
): { ok: true } | { ok: false; message: string } {
  if (scope === "report") {
    if (sectionKey !== SECTION_KEY_REPORT_NOTES) {
      return {
        ok: false,
        message: "Report-scoped manual items must use section_key REPORT_NOTES",
      };
    }
    return { ok: true };
  }
  if (isContentSectionKey(sectionKey)) {
    return { ok: true };
  }
  return {
    ok: false,
    message: "Subject-scoped manual items must use a known summary section_key",
  };
}

/** Label for assembler / API (includes system sections). */
export function sectionLabelForKey(sectionKey: string): string {
  if (sectionKey === SECTION_KEY_SYSTEM_WARNINGS) {
    return "Report notices";
  }
  if (sectionKey === SECTION_KEY_REPORT_NOTES) {
    return "Report notes";
  }
  if (isContentSectionKey(sectionKey)) {
    return SUMMARY_SECTION_LABELS[sectionKey as SummarySectionId];
  }
  return sectionKey;
}
