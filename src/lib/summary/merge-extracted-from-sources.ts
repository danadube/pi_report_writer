import { emptyExtractedData } from "@/lib/reports/fetch-extracted-for-report";
import type { ExtractedData } from "@/types";
import type { ReportSource } from "@/types";

/**
 * Concatenates structured rows from all sources into one {@link ExtractedData} for report-level logic.
 */
export function mergeExtractedDataFromSources(sources: ReportSource[]): ExtractedData {
  const out = emptyExtractedData();
  for (const s of sources) {
    const d = s.extracted_data ?? emptyExtractedData();
    out.people.push(...d.people);
    out.addresses.push(...d.addresses);
    out.phones.push(...d.phones);
    out.emails.push(...d.emails);
    out.vehicles.push(...d.vehicles);
    out.associates.push(...d.associates);
    out.employment.push(...d.employment);
  }
  return out;
}
