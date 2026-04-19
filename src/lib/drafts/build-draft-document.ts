import {
  SECTION_KEY_REPORT_NOTES,
  SECTION_KEY_SYSTEM_WARNINGS,
  sectionLabelForKey,
} from "@/lib/drafts/draft-item-registry";
import { detectLegacyAddressDraftShape } from "@/lib/drafts/legacy-address-draft";
import type { ReportDraftItemDTO, ReportDraftVersionDTO } from "@/types/draft";
import type { DraftBlock, DraftDocument, DraftSection, DraftSubject } from "@/types/draft-document";
import { SUMMARY_SECTION_ORDER } from "@/types/summary-candidates";

function blockTypeForItem(item: ReportDraftItemDTO): DraftBlock["blockType"] {
  if (item.origin_type === "system_warning") {
    return "warning";
  }
  if (item.origin_type === "manual") {
    return "manual_note";
  }
  return "fact";
}

function itemToBlock(item: ReportDraftItemDTO): DraftBlock {
  const payload =
    item.display_payload != null && typeof item.display_payload === "object" && !Array.isArray(item.display_payload)
      ? (item.display_payload as Record<string, unknown>)
      : {};

  const refs =
    item.source_ref_payload != null &&
    typeof item.source_ref_payload === "object" &&
    !Array.isArray(item.source_ref_payload)
      ? [item.source_ref_payload as Record<string, unknown>]
      : undefined;

  return {
    blockId: `item:${item.id}`,
    draftItemId: item.id,
    blockType: blockTypeForItem(item),
    entityKind: item.entity_kind,
    state: item.state,
    displayPayload: payload,
    ...(refs ? { sourceRefs: refs } : {}),
  };
}

function sortItems(items: ReportDraftItemDTO[]): ReportDraftItemDTO[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

function buildSectionsForKeys(
  sectionKeys: string[],
  items: ReportDraftItemDTO[]
): DraftSection[] {
  const sections: DraftSection[] = [];
  for (const sectionKey of sectionKeys) {
    const inSec = items.filter((i) => i.section_key === sectionKey);
    if (inSec.length === 0) continue;
    sections.push({
      sectionKey,
      sectionLabel: sectionLabelForKey(sectionKey),
      blocks: sortItems(inSec).map(itemToBlock),
    });
  }
  return sections;
}

/**
 * Assembles a single structured draft document from a version row and its items (no prose).
 */
export function buildDraftDocument(
  reportId: string,
  version: ReportDraftVersionDTO,
  items: ReportDraftItemDTO[]
): DraftDocument {
  const reportItems = items.filter((i) => i.scope === "report");
  const subjectItems = items.filter((i) => i.scope === "subject");

  const reportKeys = [...new Set(reportItems.map((i) => i.section_key))];
  reportKeys.sort((a, b) => {
    const rank = (k: string) => {
      if (k === SECTION_KEY_SYSTEM_WARNINGS) return 0;
      if (k === SECTION_KEY_REPORT_NOTES) return 1;
      return 2;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
  const reportSections = buildSectionsForKeys(reportKeys, reportItems);

  const subjectIndexes = [
    ...new Set(
      subjectItems
        .map((i) => i.subject_index)
        .filter((n): n is number => n != null && Number.isFinite(n))
    ),
  ].sort((a, b) => a - b);

  const subjects: DraftSubject[] = subjectIndexes.map((subjectIndex) => {
    const forSubject = subjectItems.filter((i) => i.subject_index === subjectIndex);
    const sections = buildSectionsForKeys(
      [...SUMMARY_SECTION_ORDER],
      forSubject
    );
    return {
      subjectIndex,
      subjectLabel: `Subject ${subjectIndex + 1}`,
      sections,
    };
  });

  return {
    reportId,
    draftVersionId: version.id,
    extractionGeneration: version.extraction_generation,
    documentVersion: version.version_number,
    status: version.status,
    blockingWarnings: version.has_blocking_warnings,
    legacyAddressShape: detectLegacyAddressDraftShape(items),
    reportSections,
    subjects,
  };
}
