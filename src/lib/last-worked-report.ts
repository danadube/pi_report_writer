export const LAST_WORKED_REPORT_STORAGE_KEY = "pi-report-writer:last-worked-report";

export type LastWorkedReportSnapshot = {
  id: string;
  subject_name: string;
  case_name: string;
  updated_at: string;
};

export function readLastWorkedReport(): LastWorkedReportSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LAST_WORKED_REPORT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
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

export function saveLastWorkedReport(snapshot: LastWorkedReportSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LAST_WORKED_REPORT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota / private mode
  }
}
