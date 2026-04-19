/**
 * Report summary curation: sections and candidate lines derived from extracted_* rows.
 */

export enum SummarySectionId {
  SUBJECT_IDENTITY = "SUBJECT_IDENTITY",
  ALIASES = "ALIASES",
  DOB_SSN_DL = "DOB_SSN_DL",
  CURRENT_ADDRESS = "CURRENT_ADDRESS",
  PRIOR_ADDRESSES = "PRIOR_ADDRESSES",
  PHONES = "PHONES",
  EMAILS = "EMAILS",
  ASSOCIATES_RELATIVES = "ASSOCIATES_RELATIVES",
  EMPLOYMENT = "EMPLOYMENT",
  VEHICLES = "VEHICLES",
}

export const SUMMARY_SECTION_ORDER: SummarySectionId[] = [
  SummarySectionId.SUBJECT_IDENTITY,
  SummarySectionId.ALIASES,
  SummarySectionId.DOB_SSN_DL,
  SummarySectionId.CURRENT_ADDRESS,
  SummarySectionId.PRIOR_ADDRESSES,
  SummarySectionId.PHONES,
  SummarySectionId.EMAILS,
  SummarySectionId.ASSOCIATES_RELATIVES,
  SummarySectionId.EMPLOYMENT,
  SummarySectionId.VEHICLES,
];

export const SUMMARY_SECTION_LABELS: Record<SummarySectionId, string> = {
  [SummarySectionId.SUBJECT_IDENTITY]: "Subject Identity",
  [SummarySectionId.ALIASES]: "Aliases",
  [SummarySectionId.DOB_SSN_DL]: "DOB / SSN / DL",
  [SummarySectionId.CURRENT_ADDRESS]: "Current Address",
  [SummarySectionId.PRIOR_ADDRESSES]: "Prior Addresses",
  [SummarySectionId.PHONES]: "Phones",
  [SummarySectionId.EMAILS]: "Emails",
  [SummarySectionId.ASSOCIATES_RELATIVES]: "Associates / Relatives",
  [SummarySectionId.EMPLOYMENT]: "Employment",
  [SummarySectionId.VEHICLES]: "Vehicles",
};

export interface SummaryCandidateSourceRef {
  source_id: string | null;
  file_name: string | null;
}

export interface SummaryCandidate {
  id: string;
  section: SummarySectionId;
  label: string | null;
  display_text: string;
  source_reference: SummaryCandidateSourceRef | null;
  selected_by_default: boolean;
  subject_index: number | null;
  ranking_score: number | null;
  /** Discriminator for persistence / tracing */
  entity_kind: string;
  entity_id: string;
}

export interface SummarySectionBlock {
  section: SummarySectionId;
  title: string;
  candidates: SummaryCandidate[];
}

export interface SummarySubjectBlock {
  subject_key: number;
  badge_label: string;
  title: string;
  sections: SummarySectionBlock[];
}

export interface SummaryPrepPayload {
  report_id: string;
  subject_blocks: SummarySubjectBlock[];
}
