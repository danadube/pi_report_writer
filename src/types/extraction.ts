export interface ExtractedPerson {
  id: string;
  report_id: string;
  source_id: string | null;
  full_name: string;
  dob: string | null;
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
  date_range_text: string | null;
  include_in_report: boolean;
}

export interface ExtractedPhone {
  id: string;
  report_id: string;
  source_id: string | null;
  phone_number: string;
  phone_type: string | null;
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
