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

/** Max selected-by-default per section (STEP 1 + sanity pass). */
const MAX_CURRENT_ADDRESSES_SELECTED = 1;
const MAX_PRIOR_ADDRESSES_DEFAULT = 3;
const MAX_PHONES_DEFAULT = 3;
const MAX_EMAILS_DEFAULT = 3;
const MAX_ASSOCIATES_DEFAULT = 3;
const MAX_EMPLOYMENT_DEFAULT = 2;
const MAX_VEHICLES_DEFAULT = 3;

const MAX_ALIASES_DEFAULT = 8;

/** Caps enforced in {@link enforceSectionSelectionCaps} (STEP 6). */
const SECTION_SELECTION_CAP: Partial<Record<SummarySectionId, number>> = {
  [SummarySectionId.CURRENT_ADDRESS]: MAX_CURRENT_ADDRESSES_SELECTED,
  [SummarySectionId.PRIOR_ADDRESSES]: MAX_PRIOR_ADDRESSES_DEFAULT,
  [SummarySectionId.PHONES]: MAX_PHONES_DEFAULT,
  [SummarySectionId.EMAILS]: MAX_EMAILS_DEFAULT,
  [SummarySectionId.ASSOCIATES_RELATIVES]: MAX_ASSOCIATES_DEFAULT,
  [SummarySectionId.EMPLOYMENT]: MAX_EMPLOYMENT_DEFAULT,
  [SummarySectionId.VEHICLES]: MAX_VEHICLES_DEFAULT,
};

const COMMON_EMAIL_HOST = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|mac|aol)\./i;

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

function recencyScoreForAddress(a: ExtractedAddress): number {
  const now = Date.now();
  const end = parseUsDate(a.date_to);
  const start = parseUsDate(a.date_from);
  let s = 0;
  if (end != null) {
    const years = (now - end) / (365.25 * 24 * 3600 * 1000);
    if (years <= 1) s += 50;
    else if (years <= 3) s += 35;
    else if (years <= 8) s += 18;
    else if (years <= 20) s += 6;
  }
  if (start != null && end == null) {
    const years = (now - start) / (365.25 * 24 * 3600 * 1000);
    if (years <= 3) s += 12;
  }
  return s;
}

function addressCleanlinessScore(a: ExtractedAddress): number {
  const st = a.street ?? "";
  let s = 0;
  if (st.length > 140) s -= 25;
  const paren = (st.match(/\(/g) ?? []).length;
  if (paren > 2) s -= 18;
  if (/^\s*po\s*box|p\.?\s*o\.?\s*box/i.test(st)) s += 3;
  return s;
}

/**
 * STEP 2 — rank addresses: recent ranges, current/latest labels, clean lines;
 * downgrade junk / duplicate-prone content.
 */
function scoreAddressRank(a: ExtractedAddress): number {
  let s = 0;
  const lab = (a.label ?? "").toLowerCase();
  const street = (a.street ?? "").toLowerCase();
  const blob = `${street} ${lab} ${a.date_range_text ?? ""}`;

  if (/subdivision name/i.test(blob)) s -= 220;
  if (/address contains/i.test(blob)) s -= 220;

  if (/\b(current|present|residential|mailing|latest)\b/.test(lab)) s += 120;
  if (/\b(prior|former|previous|old)\b/.test(lab)) s -= 55;

  s += recencyScoreForAddress(a);
  s += addressCleanlinessScore(a);

  const end = parseUsDate(a.date_to);
  const start = parseUsDate(a.date_from);
  if (end != null) s += Math.min(end / 1e12, 12);
  if (start != null) s += Math.min(start / 1e12, 4);
  if (a.include_in_report) s += 3;
  return s;
}

function addressDedupKey(a: ExtractedAddress): string {
  const street = (a.street ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const city = (a.city ?? "").trim().toLowerCase();
  const state = (a.state ?? "").trim().toLowerCase();
  const zip = (a.zip ?? "").replace(/\D/g, "").slice(0, 10);
  return `${street}|${city}|${state}|${zip}`;
}

function dedupeAddressesKeepBestScore(addresses: ExtractedAddress[]): ExtractedAddress[] {
  const byKey = new Map<string, ExtractedAddress>();
  for (const a of addresses) {
    const key = addressDedupKey(a);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, a);
      continue;
    }
    if (scoreAddressRank(a) > scoreAddressRank(existing)) {
      byKey.set(key, a);
    }
  }
  return [...byKey.values()];
}

function partitionCurrentPrior(addresses: ExtractedAddress[]): {
  current: ExtractedAddress | null;
  prior: ExtractedAddress[];
} {
  if (addresses.length === 0) return { current: null, prior: [] };
  const sorted = [...addresses].sort((a, b) => scoreAddressRank(b) - scoreAddressRank(a));
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

function normalizePhoneDigits(n: string): string {
  return n.replace(/\D/g, "");
}

/** STEP 4 — phones: boost mobile & high confidence; penalize low confidence. */
function phoneRankScore(p: ExtractedPhone): number {
  const conf = p.confidence ?? 55;
  let s = conf;
  const t = (p.phone_type ?? "").toLowerCase();
  if (t.includes("mobile") || t.includes("cell")) s += 28;
  if (t.includes("land")) s += 6;
  if (t.includes("voip")) s += 2;
  if (conf > 70) s += 18;
  if (conf < 50) s -= 38;
  if (p.include_in_report) s += 5;
  return s;
}

function dedupePhonesKeepBestScore(phones: ExtractedPhone[]): ExtractedPhone[] {
  const byDigits = new Map<string, ExtractedPhone>();
  for (const p of phones) {
    const key = normalizePhoneDigits(p.phone_number);
    if (key.length < 10) {
      const k = `raw:${p.id}`;
      byDigits.set(k, p);
      continue;
    }
    const existing = byDigits.get(key);
    if (!existing) {
      byDigits.set(key, p);
      continue;
    }
    if (phoneRankScore(p) > phoneRankScore(existing)) {
      byDigits.set(key, p);
    }
  }
  return [...byDigits.values()];
}

/** STEP 5 — emails: boost common providers & high confidence; penalize low confidence. */
function emailRankScoreNum(e: ExtractedEmail): number {
  const conf = e.confidence ?? 55;
  let s = conf;
  if (COMMON_EMAIL_HOST.test(e.email)) s += 14;
  if (conf > 70) s += 10;
  if (conf < 50) s -= 32;
  if (e.include_in_report) s += 5;
  return s;
}

function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

function dedupeEmailsKeepBestScore(emails: ExtractedEmail[]): ExtractedEmail[] {
  const byKey = new Map<string, ExtractedEmail>();
  for (const e of emails) {
    const key = normalizeEmailKey(e.email);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, e);
      continue;
    }
    if (emailRankScoreNum(e) > emailRankScoreNum(existing)) {
      byKey.set(key, e);
    }
  }
  return [...byKey.values()];
}

function associatePriority(rel: string | null): number {
  const r = (rel ?? "").toLowerCase();
  if (/\bspouse|wife|husband|partner\b/.test(r)) return 100;
  if (/\bchild|son|daughter\b/.test(r)) return 82;
  if (/\bparent|mother|father\b/.test(r)) return 78;
  if (/\bsibling|brother|sister\b/.test(r)) return 58;
  if (/\brelative|family\b/.test(r)) return 35;
  return 12;
}

function parseNameDedupKey(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1]!.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!last) return null;
  const first = parts[0]!;
  const firstInitial = first.replace(/[^a-z]/gi, "").charAt(0).toLowerCase();
  return `${last}|${firstInitial || "?"}`;
}

/**
 * STEP 3 — associates: de-dupe (last + first initial), prefer close relationships,
 * de-prioritize unclear / long extended lists.
 */
function associateRankScore(
  a: ExtractedAssociate,
  ordinal: number,
  total: number
): number {
  let s = associatePriority(a.relationship_label);
  const rel = (a.relationship_label ?? "").trim().toLowerCase();
  if (!rel || /^(relative|associate|connection|unknown|other)\b/i.test(rel)) {
    s -= 28;
  }
  if (/\b(cousin|niece|nephew|in-law|inlaw|extended|step-)\b/.test(rel)) {
    s -= 18;
  }
  if (total > 12 && ordinal >= 8) s -= 22;
  if (total > 20 && ordinal >= 10) s -= 15;
  return s;
}

function dedupeAssociatesKeepBestScore(associates: ExtractedAssociate[]): ExtractedAssociate[] {
  const total = associates.length;
  const scored = associates.map((a, i) => ({
    a,
    key: parseNameDedupKey(a.name) ?? `id:${a.id}`,
    score: associateRankScore(a, i, total),
  }));
  scored.sort((x, y) => y.score - x.score);
  const seen = new Set<string>();
  const out: ExtractedAssociate[] = [];
  for (const row of scored) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    out.push(row.a);
  }
  return out;
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

/** STEP 6 — force selected_by_default to respect per-section caps. */
function enforceSectionSelectionCaps(candidates: SummaryCandidate[]): SummaryCandidate[] {
  const caps = SECTION_SELECTION_CAP;
  const bySection = new Map<SummarySectionId, SummaryCandidate[]>();
  for (const c of candidates) {
    if (!bySection.has(c.section)) bySection.set(c.section, []);
    bySection.get(c.section)!.push(c);
  }

  const result: SummaryCandidate[] = [];
  for (const section of SUMMARY_SECTION_ORDER) {
    const list = bySection.get(section);
    if (!list?.length) continue;
    const cap = caps[section];
    if (cap == null) {
      result.push(...list);
      continue;
    }
    const selected = list.filter((c) => c.selected_by_default);
    if (selected.length <= cap) {
      result.push(...list);
      continue;
    }
    const sorted = [...selected].sort(
      (a, b) => (b.ranking_score ?? 0) - (a.ranking_score ?? 0)
    );
    const keepIds = new Set(sorted.slice(0, cap).map((x) => x.id));
    for (const c of list) {
      result.push({
        ...c,
        selected_by_default: keepIds.has(c.id),
      });
    }
  }
  return result;
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

  const addressesPrepared = dedupeAddressesKeepBestScore(data.addresses);
  const { current, prior } = partitionCurrentPrior(addressesPrepared);

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
      ranking_score: scoreAddressRank(current),
      entity_kind: "address",
      entity_id: current.id,
    });
  }

  const priorSorted = [...prior].sort((a, b) => scoreAddressRank(b) - scoreAddressRank(a));
  for (let i = 0; i < priorSorted.length; i++) {
    const a = priorSorted[i]!;
    const line = formatAddressLine(a);
    const rank = scoreAddressRank(a);
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

  const phonesPrepared = dedupePhonesKeepBestScore(data.phones).sort(
    (a, b) => phoneRankScore(b) - phoneRankScore(a)
  );
  for (let i = 0; i < phonesPrepared.length; i++) {
    const p = phonesPrepared[i]!;
    const t = p.phone_type?.trim();
    const display = t ? `${p.phone_number} — ${t}` : p.phone_number;
    const sc = phoneRankScore(p);
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

  const emailsPrepared = dedupeEmailsKeepBestScore(data.emails).sort(
    (a, b) => emailRankScoreNum(b) - emailRankScoreNum(a)
  );
  for (let i = 0; i < emailsPrepared.length; i++) {
    const e = emailsPrepared[i]!;
    push({
      id: cid(SummarySectionId.EMAILS, "email", e.id),
      section: SummarySectionId.EMAILS,
      label: "Email",
      display_text: e.email,
      source_reference: refFor(e.source_id, fileMap),
      selected_by_default: i < MAX_EMAILS_DEFAULT,
      subject_index: e.subject_index ?? subjectKey,
      ranking_score: emailRankScoreNum(e),
      entity_kind: "email",
      entity_id: e.id,
    });
  }

  const assocDeduped = dedupeAssociatesKeepBestScore(data.associates);
  const assocTotal = data.associates.length;
  const assocRanked = [...assocDeduped].sort((a, b) => {
    const sa = associateRankScore(a, 0, assocTotal);
    const sb = associateRankScore(b, 0, assocTotal);
    return sb - sa;
  });
  for (let i = 0; i < assocRanked.length; i++) {
    const a = assocRanked[i]!;
    const rel = a.relationship_label?.trim();
    const display = rel ? `${a.name} — ${rel}` : a.name;
    const rScore = associateRankScore(a, i, assocTotal);
    push({
      id: cid(SummarySectionId.ASSOCIATES_RELATIVES, "associate", a.id),
      section: SummarySectionId.ASSOCIATES_RELATIVES,
      label: rel || "Associate",
      display_text: display,
      source_reference: refFor(a.source_id, fileMap),
      selected_by_default: i < MAX_ASSOCIATES_DEFAULT,
      subject_index: a.subject_index ?? subjectKey,
      ranking_score: rScore,
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

  let flat: SummaryCandidate[] = [];
  for (const id of SUMMARY_SECTION_ORDER) {
    flat.push(...(bySection.get(id) ?? []));
  }
  flat = enforceSectionSelectionCaps(flat);

  const bySectionAfter = new Map<SummarySectionId, SummaryCandidate[]>();
  for (const id of SUMMARY_SECTION_ORDER) {
    bySectionAfter.set(id, []);
  }
  for (const c of flat) {
    bySectionAfter.get(c.section)?.push(c);
  }

  const sections: SummarySectionBlock[] = [];
  for (const id of SUMMARY_SECTION_ORDER) {
    const candidates = bySectionAfter.get(id) ?? [];
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
