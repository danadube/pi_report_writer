export interface ExtractedPerson {
  id: string;
  report_id: string;
  source_id: string | null;
  full_name: string;
  dob: string | null;
  /** SSN as extracted from source (e.g. 326-71-0673). */
  ssn: string | null;
  drivers_license_number: string | null;
  drivers_license_state: string | null;
  aliases: string[];
  include_in_report: boolean;
}

export interface ExtractedAddress {
  id: string;
  report_id: string;
  source_id: string | null;
  label: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  /** Raw range string from source when present (e.g. parenthetical). */
  date_range_text: string | null;
  /** Parsed start date when extractable (e.g. 04/03/2025). */
  date_from: string | null;
  /** Parsed end date when extractable. */
  date_to: string | null;
  include_in_report: boolean;
}

export interface ExtractedPhone {
  id: string;
  report_id: string;
  source_id: string | null;
  phone_number: string;
  /** e.g. Mobile, LandLine, VoIP, or legacy "Possible phone (High confidence)". */
  phone_type: string | null;
  /** Source-reported match confidence 0–100 when present. */
  confidence: number | null;
  include_in_report: boolean;
}

export interface ExtractedVehicle {
  id: string;
  report_id: string;
  source_id: string | null;
  year: string | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  plate: string | null;
  state: string | null;
  include_in_report: boolean;
}

export interface ExtractedAssociate {
  id: string;
  report_id: string;
  source_id: string | null;
  name: string;
  relationship_label: string | null;
  include_in_report: boolean;
}

export interface ExtractedEmployment {
  id: string;
  report_id: string;
  source_id: string | null;
  employer_name: string;
  role_title: string | null;
  include_in_report: boolean;
}

export interface ExtractedData {
  people: ExtractedPerson[];
  addresses: ExtractedAddress[];
  phones: ExtractedPhone[];
  vehicles: ExtractedVehicle[];
  associates: ExtractedAssociate[];
  employment: ExtractedEmployment[];
}

export type ExtractionStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "complete"
  | "error";

export interface ExtractionResult {
  status: ExtractionStatus;
  data: ExtractedData | null;
  error: string | null;
  raw_text: string | null;
}
