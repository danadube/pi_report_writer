import { describe, expect, it } from "vitest";
import { validateCandidateSeedDisplayPayload } from "./draft-payload-validators";
import { SummarySectionId } from "@/types/summary-candidates";

describe("validateCandidateSeedDisplayPayload", () => {
  it("allows optional address_date_metadata for seeded address lines", () => {
    const r = validateCandidateSeedDisplayPayload(
      {
        section_key: SummarySectionId.CURRENT_ADDRESS,
        display_text: "100 Example Rd, Springfield, IL 62701",
        address_date_metadata: "From 01/01/2020 to 12/31/2021",
      },
      SummarySectionId.CURRENT_ADDRESS
    );
    expect(r.ok).toBe(true);
  });
});
