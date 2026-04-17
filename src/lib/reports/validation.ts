import { ReportStatus, ReportType } from "@/types";

const REPORT_TYPES = new Set<string>(Object.values(ReportType));
const REPORT_STATUSES = new Set<string>(Object.values(ReportStatus));

export interface ParsedReportCreateBody {
  report_type: ReportType;
  status?: ReportStatus;
  case_name?: string;
  client_name?: string;
  investigator_name?: string;
  subject_name?: string;
  report_date?: string | null;
  summary_notes?: string | null;
}

export interface ParsedReportPatchBody {
  report_type?: ReportType;
  status?: ReportStatus;
  case_name?: string;
  client_name?: string;
  investigator_name?: string;
  subject_name?: string;
  report_date?: string | null;
  summary_notes?: string | null;
  generated_report_html?: string | null;
}

export function parseReportCreateBody(
  body: unknown
): { ok: true; data: ParsedReportCreateBody } | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }

  const o = body as Record<string, unknown>;

  if (typeof o.report_type !== "string" || !REPORT_TYPES.has(o.report_type)) {
    return { ok: false, error: "report_type is required and must be valid" };
  }

  const report_type = o.report_type as ReportType;

  let status: ReportStatus | undefined;
  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !REPORT_STATUSES.has(o.status)) {
      return { ok: false, error: "status must be a valid ReportStatus" };
    }
    status = o.status as ReportStatus;
  }

  return {
    ok: true,
    data: {
      report_type,
      status,
      case_name: optionalString(o.case_name),
      client_name: optionalString(o.client_name),
      investigator_name: optionalString(o.investigator_name),
      subject_name: optionalString(o.subject_name),
      report_date: optionalDateString(o.report_date),
      summary_notes: optionalNullableString(o.summary_notes),
    },
  };
}

export function parseReportPatchBody(
  body: unknown
): { ok: true; data: ParsedReportPatchBody } | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }

  const o = body as Record<string, unknown>;
  const data: ParsedReportPatchBody = {};

  if (o.report_type !== undefined) {
    if (typeof o.report_type !== "string" || !REPORT_TYPES.has(o.report_type)) {
      return { ok: false, error: "report_type must be valid" };
    }
    data.report_type = o.report_type as ReportType;
  }

  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !REPORT_STATUSES.has(o.status)) {
      return { ok: false, error: "status must be valid" };
    }
    data.status = o.status as ReportStatus;
  }

  if (o.case_name !== undefined) {
    if (typeof o.case_name !== "string") {
      return { ok: false, error: "case_name must be a string" };
    }
    data.case_name = o.case_name;
  }

  if (o.client_name !== undefined) {
    if (typeof o.client_name !== "string") {
      return { ok: false, error: "client_name must be a string" };
    }
    data.client_name = o.client_name;
  }

  if (o.investigator_name !== undefined) {
    if (typeof o.investigator_name !== "string") {
      return { ok: false, error: "investigator_name must be a string" };
    }
    data.investigator_name = o.investigator_name;
  }

  if (o.subject_name !== undefined) {
    if (typeof o.subject_name !== "string") {
      return { ok: false, error: "subject_name must be a string" };
    }
    data.subject_name = o.subject_name;
  }

  if (o.report_date !== undefined) {
    if (o.report_date !== null && typeof o.report_date !== "string") {
      return { ok: false, error: "report_date must be a string or null" };
    }
    data.report_date = o.report_date as string | null;
  }

  if (o.summary_notes !== undefined) {
    if (o.summary_notes !== null && typeof o.summary_notes !== "string") {
      return { ok: false, error: "summary_notes must be a string or null" };
    }
    data.summary_notes = o.summary_notes as string | null;
  }

  if (o.generated_report_html !== undefined) {
    if (
      o.generated_report_html !== null &&
      typeof o.generated_report_html !== "string"
    ) {
      return {
        ok: false,
        error: "generated_report_html must be a string or null",
      };
    }
    data.generated_report_html = o.generated_report_html as string | null;
  }

  return { ok: true, data };
}

function optionalString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return undefined;
  return v;
}

function optionalNullableString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  return v;
}

function optionalDateString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  return v;
}

