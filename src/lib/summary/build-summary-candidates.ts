import { groupExtractedDataBySubject } from "@/lib/reports/group-extracted-by-subject";
import { mergeExtractedDataFromSources } from "@/lib/summary/merge-extracted-from-sources";
import type {
  ExtractedAddress,
  ExtractedAssociate,
  ExtractedData,
  ExtractedEmail,
  ExtractedEmployment,
  ExtractedPerson,
  ExtractedPhone,
  ExtractedVehicle,
} from "@/types";
import type { ReportSource } from "@/types";
import {
  SUMMARY_SECTION_LABELS,
  SUMMARY_SECTION_ORDER,
  type SummaryCandidate,
  type SummaryPrepPayload,
  type SummarySectionBlock,
  SummarySectionId,
  type SummarySubjectBlock,
} from "@/types/summary-candidates";

const MAX_PRIOR_ADDRESSES_DEFAULT = 3;
const MAX_PHONES_DEFAULT = 3;
const MAX_EMAILS_DEFAULT = 3;
const MAX_ALIASES_DEFAULT = 8;
const MAX_ASSOCIATES_DEFAULT = 2;
const MAX_EMPLOYMENT_DEFAULT = 2;
const MAX_VEHICLES_DEFAULT = 5;

function sourceLabelMap(sources: ReportSource[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of sources) {
    m.set(s.id.trim().toLowerCase(), s.file_name);
  }
  return m;
}

function refFor(
  sourceId: string | null,
  fileMap: Map<string, string>
): SummaryCandidate["source_reference"] {
  if (sourceId == null || sourceId === "") {
    return null;
  }
  const key = sourceId.trim().toLowerCase();
  return {
    source_id: sourceId,
    file_name: fileMap.get(key) ?? null,
  };
}

function parseUsDate(s: string | null): number | null {
  if (!s || !s.trim()) return null;
  const t = s.trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function scoreAddressCurrent(a: ExtractedAddress): number {
  let s = 0;
  const lab = (a.label ?? "").toLowerCase();
  if (/\b(current|present|residential|mailing)\b/.test(lab)) s += 120;
  if (/\b(prior|former|previous|old)\b/.test(lab)) s -= 60;
  const end = parseUsDate(a.date_to);
  const start = parseUsDate(a.date_from);
  if (end != null) s += Math.min(end / 1e12, 15);
  if (start != null) s += Math.min(start / 1e12, 5);
  if (a.include_in_report) s += 3;
  return s;
}

function partitionCurrentPrior(addresses: ExtractedAddress[]): {
  current: ExtractedAddress | null;
  prior: ExtractedAddress[];
} {
  if (addresses.length === 0) return { current: null, prior: [] };
  const sorted = [...addresses].sort((a, b) => scoreAddressCurrent(b) - scoreAddressCurrent(a));
  const current = sorted[0]!;
  const prior = sorted.slice(1);
  prior.sort((a, b) => {
    const eb = parseUsDate(b.date_to) ?? parseUsDate(b.date_from) ?? 0;
    const ea = parseUsDate(a.date_to) ?? parseUsDate(a.date_from) ?? 0;
    return eb - ea;
  });
  return { current, prior };
}

function pickPrimaryPerson(people: ExtractedPerson[], subjectKey: number): ExtractedPerson | null {
  if (people.length === 0) return null;
  const scoped = people.filter(
    (p) => p.subject_index == null || p.subject_index === subjectKey
  );
  const pool = scoped.length > 0 ? scoped : people;
  const primary = pool.find((p) => p.is_primary_subject);
  if (primary) return primary;
  return pool[0] ?? null;
}

function phoneScore(p: ExtractedPhone): number {
  const conf = p.confidence ?? 55;
  const t = (p.phone_type ?? "").toLowerCase();
  let bonus = 0;
  if (t.includes("mobile") || t.includes("cell")) bonus += 12;
  if (t.includes("land")) bonus += 4;
  if (p.include_in_report) bonus += 5;
  return conf + bonus;
}

function emailScore(e: ExtractedEmail): number {
  return (e.confidence ?? 55) + (e.include_in_report ? 5 : 0);
}

function associatePriority(rel: string | null): number {
  const r = (rel ?? "").toLowerCase();
  if (/\bspouse|wife|husband|partner\b/.test(r)) return 100;
  if (/\bchild|son|daughter\b/.test(r)) return 80;
  if (/\bparent|mother|father\b/.test(r)) return 70;
  if (/\bsibling|brother|sister\b/.test(r)) return 60;
  if (/\brelative|family\b/.test(r)) return 40;
  return 10;
}

function vehicleScore(v: ExtractedVehicle): number {
  let s = 0;
  if (v.vin?.trim()) s += 30;
  if (v.plate?.trim()) s += 15;
  if (v.year?.trim()) s += 5;
  if (v.make?.trim()) s += 3;
  if (v.include_in_report) s += 5;
  return s;
}

function cid(
  section: SummarySectionId,
  kind: string,
  entityId: string,
  extra = ""
): string {
  const tail = extra ? `:${extra}` : "";
  return `${section}:${kind}:${entityId}${tail}`;
}

function buildSectionsForSubject(
  subjectKey: number,
  badgeLabel: string,
  title: string,
  data: ExtractedData,
  fileMap: Map<string, string>
): SummarySubjectBlock {
  const primary = pickPrimaryPerson(data.people, subjectKey);

  const bySection = new Map<SummarySectionId, SummaryCandidate[]>();
  for (const id of SUMMARY_SECTION_ORDER) {
    bySection.set(id, []);
  }

  const push = (c: SummaryCandidate) => {
    bySection.get(c.section)?.push(c);
  };

  for (const p of data.people) {
    const isPrimaryRow = primary != null && p.id === primary.id;
    const nameLine = p.full_name.trim() || "(unnamed)";
    const score = (p.is_primary_subject ? 80 : 20) + (isPrimaryRow ? 40 : 0);
    push({
      id: cid(SummarySectionId.SUBJECT_IDENTITY, "person", p.id),
      section: SummarySectionId.SUBJECT_IDENTITY,
      label: p.is_primary_subject ? "Primary subject" : "Subject",
      display_text: nameLine,
      source_reference: refFor(p.source_id, fileMap),
      selected_by_default: isPrimaryRow,
      subject_index: p.subject_index ?? subjectKey,
      ranking_score: score,
      entity_kind: "person",
      entity_id: p.id,
    });

    const aliasList = p.aliases ?? [];
    const cap = Math.min(aliasList.length, MAX_ALIASES_DEFAULT);
    for (let i = 0; i < cap; i++) {
      const alias = aliasList[i]!.trim();
      if (!alias) continue;
      push({
        id: cid(SummarySectionId.ALIASES, "alias", p.id, String(i)),
        section: SummarySectionId.ALIASES,
        label: "Alias",
        display_text: alias,
        source_reference: refFor(p.source_id, fileMap),
        selected_by_default: isPrimaryRow,
        subject_index: p.subject_index ?? subjectKey,
        ranking_score: isPrimaryRow ? 70 - i : 15,
        entity_kind: "alias",
        entity_id: p.id,
      });
    }

    const dobLine = p.dob?.trim();
    if (dobLine) {
      push({
        id: cid(SummarySectionId.DOB_SSN_DL, "dob", p.id),
        section: SummarySectionId.DOB_SSN_DL,
        label: "DOB",
        display_text: dobLine,
        source_reference: refFor(p.source_id, fileMap),
        selected_by_default: isPrimaryRow,
        subject_index: p.subject_index ?? subjectKey,
        ranking_score: isPrimaryRow ? 90 : 20,
        entity_kind: "dob",
        entity_id: p.id,
      });
    }
    const ssnLine = p.ssn?.trim();
    if (ssnLine) {
      push({
        id: cid(SummarySectionId.DOB_SSN_DL, "ssn", p.id),
        section: SummarySectionId.DOB_SSN_DL,
        label: "SSN",
        display_text: ssnLine,
        source_reference: refFor(p.source_id, fileMap),
        selected_by_default: isPrimaryRow,
        subject_index: p.subject_index ?? subjectKey,
        ranking_score: isPrimaryRow ? 88 : 18,
        entity_kind: "ssn",
        entity_id: p.id,
      });
    }
    const dlParts = [p.drivers_license_number?.trim(), p.drivers_license_state?.trim()].filter(
      Boolean
    ) as string[];
    if (dlParts.length > 0) {
      const dlText =
        p.drivers_license_number && p.drivers_license_state
          ? `${p.drivers_license_number} (${p.drivers_license_state})`
          : dlParts.join(" ");
      push({
        id: cid(SummarySectionId.DOB_SSN_DL, "dl", p.id),
        section: SummarySectionId.DOB_SSN_DL,
        label: "Driver license",
        display_text: dlText,
        source_reference: refFor(p.source_id, fileMap),
        selected_by_default: isPrimaryRow,
        subject_index: p.subject_index ?? subjectKey,
        ranking_score: isPrimaryRow ? 85 : 15,
        entity_kind: "dl",
        entity_id: p.id,
      });
    }
  }

  const { current, prior } = partitionCurrentPrior(data.addresses);

  if (current) {
    const line = formatAddressLine(current);
    push({
      id: cid(SummarySectionId.CURRENT_ADDRESS, "address", current.id),
      section: SummarySectionId.CURRENT_ADDRESS,
      label: current.label?.trim() || "Current",
      display_text: line,
      source_reference: refFor(current.source_id, fileMap),
      selected_by_default: true,
      subject_index: current.subject_index ?? subjectKey,
      ranking_score: scoreAddressCurrent(current),
      entity_kind: "address",
      entity_id: current.id,
    });
  }

  for (let i = 0; i < prior.length; i++) {
    const a = prior[i]!;
    const line = formatAddressLine(a);
    const rank = scoreAddressCurrent(a);
    push({
      id: cid(SummarySectionId.PRIOR_ADDRESSES, "address", a.id),
      section: SummarySectionId.PRIOR_ADDRESSES,
      label: a.label?.trim() || "Prior",
      display_text: line,
      source_reference: refFor(a.source_id, fileMap),
      selected_by_default: i < MAX_PRIOR_ADDRESSES_DEFAULT,
      subject_index: a.subject_index ?? subjectKey,
      ranking_score: rank,
      entity_kind: "address",
      entity_id: a.id,
    });
  }

  const phonesRanked = [...data.phones].sort((a, b) => phoneScore(b) - phoneScore(a));
  for (let i = 0; i < phonesRanked.length; i++) {
    const p = phonesRanked[i]!;
    const t = p.phone_type?.trim();
    const display = t ? `${p.phone_number} — ${t}` : p.phone_number;
    const sc = phoneScore(p);
    push({
      id: cid(SummarySectionId.PHONES, "phone", p.id),
      section: SummarySectionId.PHONES,
      label: "Phone",
      display_text: display,
      source_reference: refFor(p.source_id, fileMap),
      selected_by_default: i < MAX_PHONES_DEFAULT,
      subject_index: p.subject_index ?? subjectKey,
      ranking_score: sc,
      entity_kind: "phone",
      entity_id: p.id,
    });
  }

  const emailsRanked = [...data.emails].sort((a, b) => emailScore(b) - emailScore(a));
  for (let i = 0; i < emailsRanked.length; i++) {
    const e = emailsRanked[i]!;
    push({
      id: cid(SummarySectionId.EMAILS, "email", e.id),
      section: SummarySectionId.EMAILS,
      label: "Email",
      display_text: e.email,
      source_reference: refFor(e.source_id, fileMap),
      selected_by_default: i < MAX_EMAILS_DEFAULT,
      subject_index: e.subject_index ?? subjectKey,
      ranking_score: emailScore(e),
      entity_kind: "email",
      entity_id: e.id,
    });
  }

  const assocRanked = [...data.associates].sort(
    (a, b) => associatePriority(b.relationship_label) - associatePriority(a.relationship_label)
  );
  for (let i = 0; i < assocRanked.length; i++) {
    const a = assocRanked[i]!;
    const rel = a.relationship_label?.trim();
    const display = rel ? `${a.name} — ${rel}` : a.name;
    push({
      id: cid(SummarySectionId.ASSOCIATES_RELATIVES, "associate", a.id),
      section: SummarySectionId.ASSOCIATES_RELATIVES,
      label: rel || "Associate",
      display_text: display,
      source_reference: refFor(a.source_id, fileMap),
      selected_by_default: i < MAX_ASSOCIATES_DEFAULT,
      subject_index: a.subject_index ?? subjectKey,
      ranking_score: associatePriority(a.relationship_label),
      entity_kind: "associate",
      entity_id: a.id,
    });
  }

  const emp = [...data.employment];
  for (let i = 0; i < emp.length; i++) {
    const e = emp[i]!;
    const role = e.role_title?.trim();
    const display = role ? `${e.employer_name} — ${role}` : e.employer_name;
    push({
      id: cid(SummarySectionId.EMPLOYMENT, "employment", e.id),
      section: SummarySectionId.EMPLOYMENT,
      label: "Employment",
      display_text: display,
      source_reference: refFor(e.source_id, fileMap),
      selected_by_default: i < MAX_EMPLOYMENT_DEFAULT,
      subject_index: e.subject_index ?? subjectKey,
      ranking_score: 50 - i,
      entity_kind: "employment",
      entity_id: e.id,
    });
  }

  const vehRanked = [...data.vehicles].sort((a, b) => vehicleScore(b) - vehicleScore(a));
  for (let i = 0; i < vehRanked.length; i++) {
    const v = vehRanked[i]!;
    push({
      id: cid(SummarySectionId.VEHICLES, "vehicle", v.id),
      section: SummarySectionId.VEHICLES,
      label: "Vehicle",
      display_text: formatVehicleLine(v),
      source_reference: refFor(v.source_id, fileMap),
      selected_by_default: i < MAX_VEHICLES_DEFAULT,
      subject_index: v.subject_index ?? subjectKey,
      ranking_score: vehicleScore(v),
      entity_kind: "vehicle",
      entity_id: v.id,
    });
  }

  const sections: SummarySectionBlock[] = [];
  for (const id of SUMMARY_SECTION_ORDER) {
    const candidates = bySection.get(id) ?? [];
    if (candidates.length === 0) continue;
    sections.push({
      section: id,
      title: SUMMARY_SECTION_LABELS[id],
      candidates,
    });
  }

  return {
    subject_key: subjectKey,
    badge_label: badgeLabel,
    title,
    sections,
  };
}

function formatAddressLine(a: ExtractedAddress): string {
  const core = `${a.street}, ${a.city}, ${a.state} ${a.zip}`.replace(/\s+,/g, ",");
  const dr = a.date_range_text?.trim() || (a.date_from && a.date_to ? `${a.date_from} – ${a.date_to}` : "");
  return dr ? `${core} (${dr})` : core;
}

function formatVehicleLine(v: ExtractedVehicle): string {
  const parts = [v.year, v.make, v.model].filter((x) => x?.trim()).join(" ");
  const tail = [v.vin?.trim() ? `VIN ${v.vin}` : "", v.plate?.trim() ? `Plate ${v.plate}${v.state ? ` (${v.state})` : ""}` : ""]
    .filter(Boolean)
    .join("; ");
  return tail ? `${parts || "Vehicle"} — ${tail}` : parts || "Vehicle";
}

export function buildSummaryPrepPayload(reportId: string, sources: ReportSource[]): SummaryPrepPayload {
  const merged = mergeExtractedDataFromSources(sources);
  const fileMap = sourceLabelMap(sources);
  const subjectSlices = groupExtractedDataBySubject(merged);

  const subject_blocks: SummarySubjectBlock[] = subjectSlices.map((sec) =>
    buildSectionsForSubject(sec.subject_key, sec.badge_label, sec.title, sec.data, fileMap)
  );

  return { report_id: reportId, subject_blocks };
}
