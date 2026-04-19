import type { DraftVersionStatus } from "@/types/draft";

export type DraftDocument = {
  reportId: string;
  draftVersionId: string;
  extractionGeneration: number;
  documentVersion: number;
  status: DraftVersionStatus;
  blockingWarnings: boolean;
  /** True when address candidate rows predate the split address/date metadata payload marker. */
  legacyAddressShape: boolean;
  reportSections: DraftSection[];
  subjects: DraftSubject[];
};

export type DraftSubject = {
  subjectIndex: number;
  subjectLabel: string;
  sections: DraftSection[];
};

export type DraftSection = {
  sectionKey: string;
  sectionLabel: string;
  blocks: DraftBlock[];
};

export type DraftBlock = {
  blockId: string;
  draftItemId: string;
  blockType: "fact" | "manual_note" | "warning";
  entityKind: string;
  state: "included" | "excluded" | "review_needed";
  displayPayload: Record<string, unknown>;
  sourceRefs?: Array<Record<string, unknown>>;
};
