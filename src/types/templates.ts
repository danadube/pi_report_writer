export interface ReportSection {
  id: string;
  title: string;
  included: boolean;
  order: number;
}

export interface BackgroundReportSections {
  case_information: ReportSection;
  subject_identification: ReportSection;
  address_history: ReportSection;
  phone_information: ReportSection;
  vehicle_information: ReportSection;
  associates_relatives: ReportSection;
  employment_information: ReportSection;
  investigator_summary: ReportSection;
  disclaimer: ReportSection;
  signature_block: ReportSection;
}

export interface SurveillanceReportSections {
  case_information: ReportSection;
  subject_identification: ReportSection;
  surveillance_log: ReportSection;
  observations: ReportSection;
  investigator_summary: ReportSection;
  disclaimer: ReportSection;
  signature_block: ReportSection;
}

export interface SurveillanceEntry {
  id: string;
  time: string;
  location: string;
  observation: string;
}

export interface ReportTemplateConfig {
  reportType: import("./reports").ReportType;
  label: string;
  description: string;
  defaultSections: ReportSection[];
  supportsDocumentUpload: boolean;
  supportedSourceTypes: import("./reports").SourceDocumentType[];
}
