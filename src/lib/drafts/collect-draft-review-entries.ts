import type { DraftBlock, DraftDocument } from "@/types/draft-document";

export type DraftReviewPanelGroup = "extraction_warning" | "review_needed_fact";

export interface DraftReviewPanelEntry {
  group: DraftReviewPanelGroup;
  pathLabel: string;
  block: DraftBlock;
}

/**
 * Entries for the Review Required panel — derived by walking the assembled document from GET …/document.
 * Warnings are grouped separately from other review_needed facts.
 */
export function collectDraftReviewPanelEntries(doc: DraftDocument | null): DraftReviewPanelEntry[] {
  if (!doc) return [];
  const out: DraftReviewPanelEntry[] = [];

  const consider = (pathLabel: string, block: DraftBlock) => {
    if (block.state === "excluded") return;
    if (block.blockType === "warning") {
      out.push({ group: "extraction_warning", pathLabel, block });
      return;
    }
    if (block.state === "review_needed") {
      out.push({ group: "review_needed_fact", pathLabel, block });
    }
  };

  for (const sec of doc.reportSections) {
    for (const b of sec.blocks) {
      consider(`Report · ${sec.sectionLabel}`, b);
    }
  }
  for (const sub of doc.subjects) {
    for (const sec of sub.sections) {
      for (const b of sec.blocks) {
        consider(`${sub.subjectLabel} · ${sec.sectionLabel}`, b);
      }
    }
  }
  return out;
}
