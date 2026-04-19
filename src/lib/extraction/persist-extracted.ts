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
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("delete_extracted_for_source", {
    p_report_id: reportId,
    p_source_id: sourceId,
  });
  if (error) {
    console.error(
      "[extraction] wipeExtractedForSource failed (partial extracted_* rows may remain):",
      error.message
    );
    return { ok: false, message: error.message };
  }
  return { ok: true };
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
  const emails = capRows(data.emails);
  const vehicles = capRows(data.vehicles);
  const associates = capRows(data.associates);
  const employment = capRows(data.employment);

  if (people.length > 0) {
    const rows = people.map((p) => ({
      report_id: reportId,
      source_id: sourceId,
      full_name: clip(p.full_name, MAX_TEXT_FIELD) ?? "",
      dob: clip(p.dob, 120),
      ssn: clip(p.ssn, 32),
      drivers_license_number: clip(p.drivers_license_number, 64),
      drivers_license_state: clip(p.drivers_license_state, 8),
      aliases: (p.aliases ?? []).map((a) => clip(a, MAX_TEXT_FIELD) ?? "").filter(Boolean),
      subject_index: p.subject_index ?? null,
      is_primary_subject: p.is_primary_subject,
      include_in_report: p.include_in_report,
    }));
    const { error } = await supabase.from("extracted_people").insert(rows);
    if (error) {
      const wipe = await wipeExtractedForSource(supabase, reportId, sourceId);
      const extra = wipe.ok ? "" : `; cleanup failed: ${wipe.message}`;
      return { ok: false, message: `extracted_people insert: ${error.message}${extra}` };
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
      date_from: clip(a.date_from, 32),
      date_to: clip(a.date_to, 32),
      subject_index: a.subject_index ?? null,
      include_in_report: a.include_in_report,
    }));
    const { error } = await supabase.from("extracted_addresses").insert(rows);
    if (error) {
      const wipe = await wipeExtractedForSource(supabase, reportId, sourceId);
      const extra = wipe.ok ? "" : `; cleanup failed: ${wipe.message}`;
      return { ok: false, message: `extracted_addresses insert: ${error.message}${extra}` };
    }
  }

  if (phones.length > 0) {
    const rows = phones.map((p) => ({
      report_id: reportId,
      source_id: sourceId,
      phone_number: clip(p.phone_number, 120) ?? "",
      phone_type: clip(p.phone_type, 120),
      confidence:
        p.confidence != null && p.confidence >= 0 && p.confidence <= 100
          ? Math.round(p.confidence)
          : null,
      subject_index: p.subject_index ?? null,
      include_in_report: p.include_in_report,
    }));
    const { error } = await supabase.from("extracted_phones").insert(rows);
    if (error) {
      const wipe = await wipeExtractedForSource(supabase, reportId, sourceId);
      const extra = wipe.ok ? "" : `; cleanup failed: ${wipe.message}`;
      return { ok: false, message: `extracted_phones insert: ${error.message}${extra}` };
    }
  }

  if (emails.length > 0) {
    const rows = emails.map((e) => ({
      report_id: reportId,
      source_id: sourceId,
      email: clip(e.email, 320) ?? "",
      confidence:
        e.confidence != null && e.confidence >= 0 && e.confidence <= 100
          ? Math.round(e.confidence)
          : null,
      subject_index: e.subject_index ?? null,
      include_in_report: e.include_in_report,
    }));
    const { error } = await supabase.from("extracted_emails").insert(rows);
    if (error) {
      const wipe = await wipeExtractedForSource(supabase, reportId, sourceId);
      const extra = wipe.ok ? "" : `; cleanup failed: ${wipe.message}`;
      return { ok: false, message: `extracted_emails insert: ${error.message}${extra}` };
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
      subject_index: v.subject_index ?? null,
      include_in_report: v.include_in_report,
    }));
    const { error } = await supabase.from("extracted_vehicles").insert(rows);
    if (error) {
      const wipe = await wipeExtractedForSource(supabase, reportId, sourceId);
      const extra = wipe.ok ? "" : `; cleanup failed: ${wipe.message}`;
      return { ok: false, message: `extracted_vehicles insert: ${error.message}${extra}` };
    }
  }

  if (associates.length > 0) {
    const rows = associates.map((a) => ({
      report_id: reportId,
      source_id: sourceId,
      name: clip(a.name, MAX_TEXT_FIELD) ?? "",
      relationship_label: clip(a.relationship_label, MAX_TEXT_FIELD),
      subject_index: a.subject_index ?? null,
      include_in_report: a.include_in_report,
    }));
    const { error } = await supabase.from("extracted_associates").insert(rows);
    if (error) {
      const wipe = await wipeExtractedForSource(supabase, reportId, sourceId);
      const extra = wipe.ok ? "" : `; cleanup failed: ${wipe.message}`;
      return { ok: false, message: `extracted_associates insert: ${error.message}${extra}` };
    }
  }

  if (employment.length > 0) {
    const rows = employment.map((e) => ({
      report_id: reportId,
      source_id: sourceId,
      employer_name: clip(e.employer_name, MAX_TEXT_FIELD) ?? "",
      role_title: clip(e.role_title, MAX_TEXT_FIELD),
      subject_index: e.subject_index ?? null,
      include_in_report: e.include_in_report,
    }));
    const { error } = await supabase.from("extracted_employment").insert(rows);
    if (error) {
      const wipe = await wipeExtractedForSource(supabase, reportId, sourceId);
      const extra = wipe.ok ? "" : `; cleanup failed: ${wipe.message}`;
      return { ok: false, message: `extracted_employment insert: ${error.message}${extra}` };
    }
  }

  return { ok: true };
}

/**
 * Increments `reports.extraction_generation` when extraction materially succeeded for a source.
 * Call only from the extraction pipeline after structured `replaceExtractedDataForSource` succeeds — not after
 * failure-path wipes to empty data. Kept separate from replace so a bump failure does not imply structured rows failed.
 */
export async function bumpReportExtractionGeneration(
  supabase: Supabase,
  reportId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("increment_report_extraction_generation", {
    p_report_id: reportId,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
