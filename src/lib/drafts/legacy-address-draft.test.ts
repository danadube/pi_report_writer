import { describe, expect, it } from "vitest";
import {
  ADDRESS_PAYLOAD_FORMAT_SPLIT_V1,
  detectLegacyAddressDraftShape,
} from "@/lib/drafts/legacy-address-draft";
import type { Json } from "@/lib/supabase/database.types";
import type { ReportDraftItemDTO } from "@/types/draft";
import { SummarySectionId } from "@/types/summary-candidates";

function addressItem(display_payload: Record<string, Json | undefined>): ReportDraftItemDTO {
  return {
    id: "item-1",
    draft_version_id: "ver-1",
    scope: "subject",
    subject_index: 0,
    section_key: SummarySectionId.CURRENT_ADDRESS,
    entity_kind: "address",
    state: "included",
    origin_type: "candidate",
    display_payload: display_payload as Json,
    source_ref_payload: null,
    sort_order: 0,
    review_reason: null,
    user_note: null,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("detectLegacyAddressDraftShape", () => {
  it("is true when an address candidate row lacks the split payload marker", () => {
    expect(
      detectLegacyAddressDraftShape([
        addressItem({
          section_key: SummarySectionId.CURRENT_ADDRESS,
          display_text: "123 Main St",
        }),
      ])
    ).toBe(true);
  });

  it("is false when address candidates carry the split payload marker", () => {
    expect(
      detectLegacyAddressDraftShape([
        addressItem({
          section_key: SummarySectionId.CURRENT_ADDRESS,
          display_text: "123 Main St",
          address_payload_format: ADDRESS_PAYLOAD_FORMAT_SPLIT_V1,
        }),
      ])
    ).toBe(false);
  });

  it("ignores non-address candidates", () => {
    const phone: ReportDraftItemDTO = {
      id: "item-2",
      draft_version_id: "ver-1",
      scope: "subject",
      subject_index: 0,
      section_key: SummarySectionId.PHONES,
      entity_kind: "phone",
      state: "included",
      origin_type: "candidate",
      display_payload: {
        section_key: SummarySectionId.PHONES,
        display_text: "555-0100",
      } as Json,
      source_ref_payload: null,
      sort_order: 1,
      review_reason: null,
      user_note: null,
      created_by: "user-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    expect(detectLegacyAddressDraftShape([phone])).toBe(false);
  });
});
