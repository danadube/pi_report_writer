import type { ExtractedData } from "@/types";

/**
 * TODO: Implement TLO comprehensive report parser.
 *
 * TLO reports are structured PDFs with consistent section headings.
 * This parser should:
 * 1. Split raw text into sections using heading patterns
 * 2. Apply field-level regex/string parsing within each section
 * 3. Return normalized ExtractedData
 *
 * Target section headings (verify against actual TLO samples):
 * - "SUBJECT INFORMATION" or "PERSONAL INFORMATION"
 * - "ADDRESS SUMMARY" or "ADDRESSES"
 * - "PHONE SUMMARY" or "PHONES"
 * - "VEHICLES" or "VEHICLE SUMMARY"
 * - "ASSOCIATES" or "RELATIVES"
 * - "EMPLOYMENT" or "EMPLOYERS"
 *
 * Store the raw extracted text in report_sources.extracted_text
 * so parsing can be re-run without re-uploading the file.
 */
export function parseTlo(rawText: string): ExtractedData {
  // TODO: Implement section splitter
  // TODO: Implement field parsers per section
  // TODO: Return normalized ExtractedData with include_in_report=true defaults

  return {
    people: [],
    addresses: [],
    phones: [],
    vehicles: [],
    associates: [],
    employment: [],
  };
}
