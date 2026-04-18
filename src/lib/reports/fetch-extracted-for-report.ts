import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ExtractedAddress,
  ExtractedAssociate,
  ExtractedData,
  ExtractedEmail,
  ExtractedEmployment,
  ExtractedPerson,
  ExtractedPhone,
  ExtractedVehicle,
  ReportSource,
} from "@/types";

type Supabase = SupabaseClient<Database>;

export function emptyExtractedData(): ExtractedData {
  return {
    people: [],
    addresses: [],
    phones: [],
    emails: [],
    vehicles: [],
    associates: [],
    employment: [],
  };
}

/** Total structured rows attached to a source (used for accurate UI copy). */
export function countStructuredFields(data: ExtractedData): number {
  return (
    data.people.length +
    data.addresses.length +
    data.phones.length +
    data.emails.length +
    data.vehicles.length +
    data.associates.length +
    data.employment.length
  );
}

/**
 * Stable fingerprint for syncing client report state when server-side sources / extraction change.
 */
export function sourcesStructuredSyncKey(sources: ReportSource[] | undefined): string {
  if (!sources?.length) {
    return "";
  }
  return [...sources]
    .map((s) => {
      const ed = s.extracted_data ?? emptyExtractedData();
      return `${s.id}:${s.extraction_status}:${countStructuredFields(ed)}`;
    })
    .sort()
    .join("|");
}

/** Normalize so report_sources.id and extracted_*.source_id always match Map keys. */
export function normalizeSourceIdForMerge(id: string): string {
  return id.trim().toLowerCase();
}

function ensureBucket(
  map: Map<string, ExtractedData>,
  sourceId: string
): ExtractedData {
  const key = normalizeSourceIdForMerge(sourceId);
  let d = map.get(key);
  if (!d) {
    d = emptyExtractedData();
    map.set(key, d);
  }
  return d;
}

/**
 * Loads all extracted_* rows for a report and groups them by source_id.
 */
export async function fetchExtractedGroupedBySource(
  supabase: Supabase,
  reportId: string
): Promise<
  { ok: true; bySource: Map<string, ExtractedData> } | { ok: false; message: string }
> {
  const [
    { data: peopleRows, error: ePeople },
    { data: addrRows, error: eAddr },
    { data: phoneRows, error: ePhone },
    { data: emailRows, error: eEmail },
    { data: vehRows, error: eVeh },
    { data: assocRows, error: eAssoc },
    { data: empRows, error: eEmp },
  ] = await Promise.all([
    supabase.from("extracted_people").select("*").eq("report_id", reportId),
    supabase.from("extracted_addresses").select("*").eq("report_id", reportId),
    supabase.from("extracted_phones").select("*").eq("report_id", reportId),
    supabase.from("extracted_emails").select("*").eq("report_id", reportId),
    supabase.from("extracted_vehicles").select("*").eq("report_id", reportId),
    supabase.from("extracted_associates").select("*").eq("report_id", reportId),
    supabase.from("extracted_employment").select("*").eq("report_id", reportId),
  ]);

  const err =
    ePeople ??
    eAddr ??
    ePhone ??
    eEmail ??
    eVeh ??
    eAssoc ??
    eEmp ??
    null;
  if (err) {
    return { ok: false, message: err.message };
  }

  const bySource = new Map<string, ExtractedData>();

  for (const row of peopleRows ?? []) {
    if (row.source_id == null || String(row.source_id).trim() === "") {
      continue;
    }
    const p: ExtractedPerson = {
      id: row.id,
      report_id: row.report_id,
      source_id: row.source_id,
      full_name: row.full_name,
      dob: row.dob,
      ssn: row.ssn,
      drivers_license_number: row.drivers_license_number,
      drivers_license_state: row.drivers_license_state,
      aliases: row.aliases ?? [],
      subject_index: row.subject_index ?? null,
      is_primary_subject: row.is_primary_subject ?? true,
      include_in_report: row.include_in_report,
    };
    ensureBucket(bySource, String(row.source_id)).people.push(p);
  }

  for (const row of addrRows ?? []) {
    if (row.source_id == null || String(row.source_id).trim() === "") {
      continue;
    }
    const a: ExtractedAddress = {
      id: row.id,
      report_id: row.report_id,
      source_id: row.source_id,
      label: row.label,
      street: row.street,
      city: row.city,
      state: row.state,
      zip: row.zip,
      date_range_text: row.date_range_text,
      date_from: row.date_from,
      date_to: row.date_to,
      include_in_report: row.include_in_report,
    };
    ensureBucket(bySource, String(row.source_id)).addresses.push(a);
  }

  for (const row of phoneRows ?? []) {
    if (row.source_id == null || String(row.source_id).trim() === "") {
      continue;
    }
    const p: ExtractedPhone = {
      id: row.id,
      report_id: row.report_id,
      source_id: row.source_id,
      phone_number: row.phone_number,
      phone_type: row.phone_type,
      confidence: row.confidence,
      include_in_report: row.include_in_report,
    };
    ensureBucket(bySource, String(row.source_id)).phones.push(p);
  }

  for (const row of emailRows ?? []) {
    if (row.source_id == null || String(row.source_id).trim() === "") {
      continue;
    }
    const e: ExtractedEmail = {
      id: row.id,
      report_id: row.report_id,
      source_id: row.source_id,
      email: row.email,
      confidence: row.confidence,
      include_in_report: row.include_in_report,
    };
    ensureBucket(bySource, String(row.source_id)).emails.push(e);
  }

  for (const row of vehRows ?? []) {
    if (row.source_id == null || String(row.source_id).trim() === "") {
      continue;
    }
    const v: ExtractedVehicle = {
      id: row.id,
      report_id: row.report_id,
      source_id: row.source_id,
      year: row.year,
      make: row.make,
      model: row.model,
      vin: row.vin,
      plate: row.plate,
      state: row.state,
      include_in_report: row.include_in_report,
    };
    ensureBucket(bySource, String(row.source_id)).vehicles.push(v);
  }

  for (const row of assocRows ?? []) {
    if (row.source_id == null || String(row.source_id).trim() === "") {
      continue;
    }
    const a: ExtractedAssociate = {
      id: row.id,
      report_id: row.report_id,
      source_id: row.source_id,
      name: row.name,
      relationship_label: row.relationship_label,
      include_in_report: row.include_in_report,
    };
    ensureBucket(bySource, String(row.source_id)).associates.push(a);
  }

  for (const row of empRows ?? []) {
    if (row.source_id == null || String(row.source_id).trim() === "") {
      continue;
    }
    const e: ExtractedEmployment = {
      id: row.id,
      report_id: row.report_id,
      source_id: row.source_id,
      employer_name: row.employer_name,
      role_title: row.role_title,
      include_in_report: row.include_in_report,
    };
    ensureBucket(bySource, String(row.source_id)).employment.push(e);
  }

  return { ok: true, bySource };
}

export function mergeSourcesWithExtracted(
  sources: ReportSource[],
  bySource: Map<string, ExtractedData>
): ReportSource[] {
  return sources.map((s) => ({
    ...s,
    extracted_data:
      bySource.get(normalizeSourceIdForMerge(s.id)) ?? emptyExtractedData(),
  }));
}
