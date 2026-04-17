import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ExtractedData } from "@/types";

type Supabase = SupabaseClient<Database>;

/** Guard against runaway parser output per table (Postgres row / payload limits). */
const MAX_ROWS_PER_TABLE = 500;
const MAX_TEXT_FIELD = 8000;

function clip(s: string | null | undefined, max: number): string | null {
  if (s == null || s === "") {
    return s === "" ? "" : null;
  }
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function capRows<T>(rows: T[]): T[] {
  if (rows.length <= MAX_ROWS_PER_TABLE) {
    return rows;
  }
  return rows.slice(0, MAX_ROWS_PER_TABLE);
}

async function wipeExtractedForSource(
  supabase: Supabase,
  reportId: string,
  sourceId: string
): Promise<void> {
  const { error } = await supabase.rpc("delete_extracted_for_source", {
    p_report_id: reportId,
    p_source_id: sourceId,
  });
  if (error) {
    console.error(
      "[extraction] wipeExtractedForSource failed (partial extracted_* rows may remain):",
      error.message
    );
  }
}

/**
 * Replace all structured rows previously produced for this source, then insert
 * the new parse result. Re-runs are idempotent per source_id (no duplicate rows).
 *
 * Deletes use a single DB transaction (RPC) so we never half-clear extracted_*.
 * If an insert batch fails after delete, we wipe again so we do not leave partial rows.
 */
export async function replaceExtractedDataForSource(
  supabase: Supabase,
  reportId: string,
  sourceId: string,
  data: ExtractedData
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delErr } = await supabase.rpc("delete_extracted_for_source", {
    p_report_id: reportId,
    p_source_id: sourceId,
  });

  if (delErr) {
    return {
      ok: false,
      message: `delete_extracted_for_source: ${delErr.message}`,
    };
  }

  const people = capRows(data.people);
  const addresses = capRows(data.addresses);
  const phones = capRows(data.phones);
  const vehicles = capRows(data.vehicles);
  const associates = capRows(data.associates);
  const employment = capRows(data.employment);

  if (people.length > 0) {
    const rows = people.map((p) => ({
      report_id: reportId,
      source_id: sourceId,
      full_name: clip(p.full_name, MAX_TEXT_FIELD) ?? "",
      dob: clip(p.dob, 120),
      aliases: (p.aliases ?? []).map((a) => clip(a, MAX_TEXT_FIELD) ?? "").filter(Boolean),
      include_in_report: p.include_in_report,
    }));
    const { error } = await supabase.from("extracted_people").insert(rows);
    if (error) {
      await wipeExtractedForSource(supabase, reportId, sourceId);
      return { ok: false, message: `extracted_people insert: ${error.message}` };
    }
  }

  if (addresses.length > 0) {
    const rows = addresses.map((a) => ({
      report_id: reportId,
      source_id: sourceId,
      label: clip(a.label, MAX_TEXT_FIELD),
      street: clip(a.street, MAX_TEXT_FIELD) ?? "",
      city: clip(a.city, 500) ?? "",
      state: clip(a.state, 32) ?? "",
      zip: clip(a.zip, 32) ?? "",
      date_range_text: clip(a.date_range_text, MAX_TEXT_FIELD),
      include_in_report: a.include_in_report,
    }));
    const { error } = await supabase.from("extracted_addresses").insert(rows);
    if (error) {
      await wipeExtractedForSource(supabase, reportId, sourceId);
      return { ok: false, message: `extracted_addresses insert: ${error.message}` };
    }
  }

  if (phones.length > 0) {
    const rows = phones.map((p) => ({
      report_id: reportId,
      source_id: sourceId,
      phone_number: clip(p.phone_number, 120) ?? "",
      phone_type: clip(p.phone_type, 120),
      include_in_report: p.include_in_report,
    }));
    const { error } = await supabase.from("extracted_phones").insert(rows);
    if (error) {
      await wipeExtractedForSource(supabase, reportId, sourceId);
      return { ok: false, message: `extracted_phones insert: ${error.message}` };
    }
  }

  if (vehicles.length > 0) {
    const rows = vehicles.map((v) => ({
      report_id: reportId,
      source_id: sourceId,
      year: clip(v.year, 16),
      make: clip(v.make, 200),
      model: clip(v.model, 200),
      vin: clip(v.vin, 32),
      plate: clip(v.plate, 32),
      state: clip(v.state, 16),
      include_in_report: v.include_in_report,
    }));
    const { error } = await supabase.from("extracted_vehicles").insert(rows);
    if (error) {
      await wipeExtractedForSource(supabase, reportId, sourceId);
      return { ok: false, message: `extracted_vehicles insert: ${error.message}` };
    }
  }

  if (associates.length > 0) {
    const rows = associates.map((a) => ({
      report_id: reportId,
      source_id: sourceId,
      name: clip(a.name, MAX_TEXT_FIELD) ?? "",
      relationship_label: clip(a.relationship_label, MAX_TEXT_FIELD),
      include_in_report: a.include_in_report,
    }));
    const { error } = await supabase.from("extracted_associates").insert(rows);
    if (error) {
      await wipeExtractedForSource(supabase, reportId, sourceId);
      return { ok: false, message: `extracted_associates insert: ${error.message}` };
    }
  }

  if (employment.length > 0) {
    const rows = employment.map((e) => ({
      report_id: reportId,
      source_id: sourceId,
      employer_name: clip(e.employer_name, MAX_TEXT_FIELD) ?? "",
      role_title: clip(e.role_title, MAX_TEXT_FIELD),
      include_in_report: e.include_in_report,
    }));
    const { error } = await supabase.from("extracted_employment").insert(rows);
    if (error) {
      await wipeExtractedForSource(supabase, reportId, sourceId);
      return { ok: false, message: `extracted_employment insert: ${error.message}` };
    }
  }

  return { ok: true };
}
