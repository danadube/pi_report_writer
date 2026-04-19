import type { ExtractedAddress } from "@/types/extraction";

/** Single-line postal line (no dates). */
export function formatAddressCoreLine(a: ExtractedAddress): string {
  return `${a.street}, ${a.city}, ${a.state} ${a.zip}`.replace(/\s+,/g, ",");
}

/**
 * Report-style labeled residency period for draft/summary metadata, or null if no dates.
 */
export function formatAddressPeriodLabel(a: ExtractedAddress): string | null {
  const from = a.date_from?.trim();
  const to = a.date_to?.trim();
  const raw = a.date_range_text?.trim();

  if (from && to) {
    return `From ${from} to ${to}`;
  }
  if (from && !to) {
    return `From ${from}`;
  }
  if (!from && to) {
    return `To ${to}`;
  }
  if (raw) {
    const normalized = raw.replace(/\s+/g, " ");
    const m = normalized.match(/^(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})$/i);
    if (m?.[1] && m[2]) {
      return `From ${m[1]} to ${m[2]}`;
    }
    return `From ${normalized}`;
  }
  return null;
}
