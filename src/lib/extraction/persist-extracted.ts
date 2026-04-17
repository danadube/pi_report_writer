import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ExtractedData } from "@/types";

type Supabase = SupabaseClient<Database>;

/**
 * Replace all structured rows previously produced for this source, then insert
 * the new parse result. Re-runs are idempotent per source_id (no duplicate rows).
 */
export async function replaceExtractedDataForSource(
  supabase: Supabase,
  reportId: string,
  sourceId: string,
  data: ExtractedData
): Promise<{ ok: true } | { ok: false; message: string }> {
  const tables = [
    "extracted_people",
    "extracted_addresses",
    "extracted_phones",
    "extracted_vehicles",
    "extracted_associates",
    "extracted_employment",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("report_id", reportId)
      .eq("source_id", sourceId);

    if (error) {
      return { ok: false, message: `${table} delete: ${error.message}` };
    }
  }

  if (data.people.length > 0) {
    const rows = data.people.map((p) => ({
      report_id: reportId,
      source_id: sourceId,
      full_name: p.full_name,
      dob: p.dob,
      aliases: p.aliases,
      include_in_report: p.include_in_report,
    }));
    const { error } = await supabase.from("extracted_people").insert(rows);
    if (error) {
      return { ok: false, message: `extracted_people insert: ${error.message}` };
    }
  }

  if (data.addresses.length > 0) {
    const rows = data.addresses.map((a) => ({
      report_id: reportId,
      source_id: sourceId,
      label: a.label,
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      date_range_text: a.date_range_text,
      include_in_report: a.include_in_report,
    }));
    const { error } = await supabase.from("extracted_addresses").insert(rows);
    if (error) {
      return { ok: false, message: `extracted_addresses insert: ${error.message}` };
    }
  }

  if (data.phones.length > 0) {
    const rows = data.phones.map((p) => ({
      report_id: reportId,
      source_id: sourceId,
      phone_number: p.phone_number,
      phone_type: p.phone_type,
      include_in_report: p.include_in_report,
    }));
    const { error } = await supabase.from("extracted_phones").insert(rows);
    if (error) {
      return { ok: false, message: `extracted_phones insert: ${error.message}` };
    }
  }

  if (data.vehicles.length > 0) {
    const rows = data.vehicles.map((v) => ({
      report_id: reportId,
      source_id: sourceId,
      year: v.year,
      make: v.make,
      model: v.model,
      vin: v.vin,
      plate: v.plate,
      state: v.state,
      include_in_report: v.include_in_report,
    }));
    const { error } = await supabase.from("extracted_vehicles").insert(rows);
    if (error) {
      return { ok: false, message: `extracted_vehicles insert: ${error.message}` };
    }
  }

  if (data.associates.length > 0) {
    const rows = data.associates.map((a) => ({
      report_id: reportId,
      source_id: sourceId,
      name: a.name,
      relationship_label: a.relationship_label,
      include_in_report: a.include_in_report,
    }));
    const { error } = await supabase.from("extracted_associates").insert(rows);
    if (error) {
      return { ok: false, message: `extracted_associates insert: ${error.message}` };
    }
  }

  if (data.employment.length > 0) {
    const rows = data.employment.map((e) => ({
      report_id: reportId,
      source_id: sourceId,
      employer_name: e.employer_name,
      role_title: e.role_title,
      include_in_report: e.include_in_report,
    }));
    const { error } = await supabase.from("extracted_employment").insert(rows);
    if (error) {
      return { ok: false, message: `extracted_employment insert: ${error.message}` };
    }
  }

  return { ok: true };
}
