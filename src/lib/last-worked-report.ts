export const LAST_WORKED_REPORT_STORAGE_KEY = "pi-report-writer:last-worked-report";

/** Same-tab updates (the native `storage` event only fires for other documents). */
export const LAST_WORKED_REPORT_UPDATED_EVENT = "pi-last-worked-report-updated";

export type LastWorkedReportSnapshot = {
  id: string;
  subject_name: string;
  case_name: string;
  updated_at: string;
};

let snapshotCacheRaw: string | null | undefined;
let snapshotCacheParsed: LastWorkedReportSnapshot | null | undefined;

function parseLastWorkedReportRaw(raw: string | null): LastWorkedReportSnapshot | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.id !== "string" ||
      typeof o.subject_name !== "string" ||
      typeof o.case_name !== "string" ||
      typeof o.updated_at !== "string"
    ) {
      return null;
    }
    return {
      id: o.id,
      subject_name: o.subject_name,
      case_name: o.case_name,
      updated_at: o.updated_at,
    };
  } catch {
    return null;
  }
}

/**
 * Reads localStorage and returns a stable object reference for unchanged raw JSON
 * (needed for useSyncExternalStore snapshot equality).
 */
export function readLastWorkedReport(): LastWorkedReportSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LAST_WORKED_REPORT_STORAGE_KEY);
    if (raw === snapshotCacheRaw) {
      return snapshotCacheParsed ?? null;
    }
    snapshotCacheRaw = raw;
    snapshotCacheParsed = parseLastWorkedReportRaw(raw);
    return snapshotCacheParsed;
  } catch {
    return null;
  }
}

export function saveLastWorkedReport(snapshot: LastWorkedReportSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LAST_WORKED_REPORT_STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new Event(LAST_WORKED_REPORT_UPDATED_EVENT));
  } catch {
    // ignore quota / private mode
  }
}
