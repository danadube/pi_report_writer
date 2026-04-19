import type { ReportDraftItemDTO } from "@/types/draft";
import { SummarySectionId } from "@/types/summary-candidates";

/** Set on address candidates seeded after the split address / date metadata improvement. */
export const ADDRESS_PAYLOAD_FORMAT_SPLIT_V1 = "split_v1" as const;

/**
 * True when this version includes at least one address candidate row that predates the
 * split metadata payload marker. Does not inspect or parse display_text.
 */
export function detectLegacyAddressDraftShape(items: ReportDraftItemDTO[]): boolean {
  for (const item of items) {
    if (item.origin_type !== "candidate" || item.entity_kind !== "address") {
      continue;
    }
    if (
      item.section_key !== SummarySectionId.CURRENT_ADDRESS &&
      item.section_key !== SummarySectionId.PRIOR_ADDRESSES
    ) {
      continue;
    }
    const p = item.display_payload;
    if (p == null || typeof p !== "object" || Array.isArray(p)) {
      continue;
    }
    const fmt = (p as Record<string, unknown>).address_payload_format;
    if (fmt === ADDRESS_PAYLOAD_FORMAT_SPLIT_V1) {
      continue;
    }
    return true;
  }
  return false;
}
