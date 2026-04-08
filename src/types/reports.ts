export enum ReportType {
  BACKGROUND_INVESTIGATION = "BACKGROUND_INVESTIGATION",
  SURVEILLANCE = "SURVEILLANCE",
}

export enum ReportStatus {
  DRAFT = "DRAFT",
  FINAL = "FINAL",
  ARCHIVED = "ARCHIVED",
}

export enum SourceDocumentType {
  TLO_COMPREHENSIVE = "TLO_COMPREHENSIVE",
  DMV_RECORDS = "DMV_RECORDS",
  MANUAL_ENTRY = "MANUAL_ENTRY",
  OTHER = "OTHER",
}

export interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  organization_id: string | null;
  organization?: Organization;
  created_at: string;
}

export interface ReportMetadata {
  case_name: string;
  client_name: string;
  investigator_name: string;
  subject_name: string;
  report_date: string;
}

export interface Report extends ReportMetadata {
  id: string;
  organization_id: string | null;
  created_by_user_id: string;
  report_type: ReportType;
  status: ReportStatus;
  summary_notes: string | null;
  generated_report_html: string | null;
  created_at: string;
  updated_at: string;
  sources?: ReportSource[];
}

export interface ReportSource {
  id: string;
  report_id: string;
  source_type: SourceDocumentType;
  file_name: string;
  file_url: string;
  extracted_text: string | null;
  created_at: string;
}

export type ReportCreateInput = Omit<
  Report,
  "id" | "created_at" | "updated_at" | "sources"
>;

export type ReportUpdateInput = Partial<ReportCreateInput>;

export interface ReportListItem {
  id: string;
  report_type: ReportType;
  status: ReportStatus;
  case_name: string;
  subject_name: string;
  investigator_name: string;
  report_date: string;
  created_at: string;
  updated_at: string;
}
