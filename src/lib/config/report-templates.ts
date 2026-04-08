import {
  ReportType,
  SourceDocumentType,
  type ReportTemplateConfig,
} from "@/types";

export const REPORT_TEMPLATE_CONFIGS: Record<
  ReportType,
  ReportTemplateConfig
> = {
  [ReportType.BACKGROUND_INVESTIGATION]: {
    reportType: ReportType.BACKGROUND_INVESTIGATION,
    label: "Background Investigation Report",
    description:
      "Comprehensive background report generated from source documents such as TLO comprehensive reports.",
    supportsDocumentUpload: true,
    supportedSourceTypes: [
      SourceDocumentType.TLO_COMPREHENSIVE,
      SourceDocumentType.DMV_RECORDS,
    ],
    defaultSections: [
      { id: "case_information", title: "Case Information", included: true, order: 1 },
      { id: "subject_identification", title: "Subject Identification", included: true, order: 2 },
      { id: "address_history", title: "Address History", included: true, order: 3 },
      { id: "phone_information", title: "Phone Information", included: true, order: 4 },
      { id: "vehicle_information", title: "Vehicle Information", included: true, order: 5 },
      { id: "associates_relatives", title: "Associates / Relatives", included: true, order: 6 },
      { id: "employment_information", title: "Employment Information", included: true, order: 7 },
      { id: "investigator_summary", title: "Investigator Summary & Notes", included: true, order: 8 },
      { id: "disclaimer", title: "Disclaimer / Source Note", included: true, order: 9 },
      { id: "signature_block", title: "Signature Block", included: true, order: 10 },
    ],
  },
  [ReportType.SURVEILLANCE]: {
    reportType: ReportType.SURVEILLANCE,
    label: "Surveillance Report",
    description:
      "Chronological surveillance log with observations, locations, and investigator notes.",
    supportsDocumentUpload: false,
    supportedSourceTypes: [SourceDocumentType.MANUAL_ENTRY],
    defaultSections: [
      { id: "case_information", title: "Case Information", included: true, order: 1 },
      { id: "subject_identification", title: "Subject Identification", included: true, order: 2 },
      { id: "surveillance_log", title: "Surveillance Log", included: true, order: 3 },
      { id: "observations", title: "Observations", included: true, order: 4 },
      { id: "investigator_summary", title: "Investigator Summary & Notes", included: true, order: 5 },
      { id: "disclaimer", title: "Disclaimer", included: true, order: 6 },
      { id: "signature_block", title: "Signature Block", included: true, order: 7 },
    ],
  },
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  [ReportType.BACKGROUND_INVESTIGATION]: "Background Investigation",
  [ReportType.SURVEILLANCE]: "Surveillance",
};

export const SOURCE_DOCUMENT_TYPE_LABELS: Record<SourceDocumentType, string> =
  {
    [SourceDocumentType.TLO_COMPREHENSIVE]: "TLO Comprehensive Report",
    [SourceDocumentType.DMV_RECORDS]: "DMV / Records Research",
    [SourceDocumentType.MANUAL_ENTRY]: "Manual Entry",
    [SourceDocumentType.OTHER]: "Other",
  };
