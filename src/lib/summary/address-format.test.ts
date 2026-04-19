import { describe, expect, it } from "vitest";
import type { ExtractedAddress } from "@/types/extraction";
import { formatAddressCoreLine, formatAddressPeriodLabel } from "./address-format";

function baseAddress(over: Partial<ExtractedAddress> = {}): ExtractedAddress {
  return {
    id: "a1",
    report_id: "r1",
    source_id: null,
    label: null,
    street: "123 Main St",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    date_range_text: null,
    date_from: null,
    date_to: null,
    subject_index: null,
    include_in_report: true,
    ...over,
  };
}

describe("formatAddressCoreLine", () => {
  it("formats postal line without embedding dates", () => {
    expect(formatAddressCoreLine(baseAddress())).toBe("123 Main St, Chicago, IL 60601");
  });
});

describe("formatAddressPeriodLabel", () => {
  it("labels a full range from structured fields", () => {
    expect(
      formatAddressPeriodLabel(
        baseAddress({ date_from: "01/15/2020", date_to: "03/01/2021" })
      )
    ).toBe("From 01/15/2020 to 03/01/2021");
  });

  it("normalizes parser date_range_text into From … to …", () => {
    expect(
      formatAddressPeriodLabel(
        baseAddress({
          date_from: null,
          date_to: null,
          date_range_text: "04/01/2024 to 04/02/2024",
        })
      )
    ).toBe("From 04/01/2024 to 04/02/2024");
  });

  it("returns null when no date information", () => {
    expect(formatAddressPeriodLabel(baseAddress())).toBeNull();
  });
});
