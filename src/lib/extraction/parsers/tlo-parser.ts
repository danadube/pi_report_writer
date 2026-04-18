import type {
  ExtractedAddress,
  ExtractedAssociate,
  ExtractedData,
  ExtractedEmployment,
  ExtractedPerson,
  ExtractedPhone,
  ExtractedVehicle,
} from "@/types";

const PLACEHOLDER_REPORT = "";

function id(): string {
  return crypto.randomUUID();
}

/** US phone numbers (loose); section chunks + fallback scans. */
const PHONE_RE =
  /(?:\+1[-.\s]?)?(?:\(?\d{3}\)[-.\s]?|\d{3}[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

/** 17-char VIN (no I/O/Q). */
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

const SUBJECT_LINE_RE = /^\s*Subject\s+\d+\s+of\s+\d+\b/i;

function lineHasSubjectMarker(line: string): boolean {
  const t = line.trim();
  if (SUBJECT_LINE_RE.test(t)) {
    return true;
  }
  return /\bSubject\s+\d+\s+of\s+\d+\b/i.test(t);
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "");
}

/** City, ST  ZIP */
const CITY_ST_ZIP_RE =
  /^([A-Za-z][A-Za-z\s'.-]+),\s*([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?\s*$/;

const CITY_ST_ZIP_NO_COMMA_RE =
  /^([A-Za-z][A-Za-z\s'.-]+?)\s+([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?\s*$/;

const DATE_RANGE_HINT_RE =
  /\b(?:Present|CURRENT|\d{1,2}\/\d{4}|\d{4})\b.*(?:[-–—]|through|to)\b.*\b(?:Present|CURRENT|\d{1,2}\/\d{4}|\d{4})\b/i;

function normalizePhoneDigits(s: string): string {
  return s.replace(/\D/g, "").slice(-10);
}

function normalizeName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function lineLooksLikeSectionHeader(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 90) {
    return false;
  }
  if (lineHasSubjectMarker(t)) {
    return true;
  }
  if (
    /^(?:Address\s+History|Residential\s+Address|Mailing\s+Address|Current\s+Address|Previous\s+Address|Possible\s+Phones?|Possible\s+Relatives|Known\s+Relatives|Current\s+Other\s+Phones|Vehicle|Vehicles|Registered|Employment|Employers?|Work\s+History|Driver|License|D\s*\/\s*L)\b/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

function isCurrentOtherPhonesAtAddressLine(line: string): boolean {
  return /Current\s+Other\s+Phones\s+at\s+address/i.test(line);
}

function isStreetLine(s: string): boolean {
  const t = s.trim();
  if (t.length < 4 || t.length > 120) {
    return false;
  }
  if (isCurrentOtherPhonesAtAddressLine(t)) {
    return false;
  }
  return (
    /^\d+\s+[A-Za-z0-9#]/.test(t) ||
    /^(?:P\.?O\.?\s*BOX|PO\s*BOX)\b/i.test(t) ||
    /^\d+\s+[A-Za-z].+#/.test(t)
  );
}

function isUnitContinuationLine(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 80) {
    return false;
  }
  return /^(?:APT|APARTMENT|UNIT|STE|SUITE|BLDG|BUILDING|FL|FLOOR|RM|ROOM|#)\b/i.test(t);
}

function parseCityStateZipLine(
  line: string
): { city: string; state: string; zip: string } | null {
  const t = line.trim();
  let m = t.match(CITY_ST_ZIP_RE);
  if (m) {
    return {
      city: m[1].trim(),
      state: m[2],
      zip: m[3] + (m[4] ? `-${m[4]}` : ""),
    };
  }
  m = t.match(CITY_ST_ZIP_NO_COMMA_RE);
  if (m) {
    return {
      city: m[1].trim(),
      state: m[2],
      zip: m[3] + (m[4] ? `-${m[4]}` : ""),
    };
  }
  return null;
}

function sliceAfterHeader(text: string, headerRe: RegExp): string | null {
  const m = text.match(headerRe);
  if (!m || m.index === undefined) {
    return null;
  }
  return text.slice(m.index + m[0].length);
}

function takeSectionChunk(chunk: string, maxLen = 20000): string {
  const lines = chunk.split("\n");
  const buf: string[] = [];
  for (const line of lines) {
    if (
      buf.length > 0 &&
      lineLooksLikeSectionHeader(line) &&
      !isCurrentOtherPhonesAtAddressLine(line)
    ) {
      break;
    }
    buf.push(line);
    if (buf.join("\n").length > maxLen) {
      break;
    }
  }
  return buf.join("\n").trim();
}

function extractDobFromLine(line: string): string | null {
  const m = line.match(
    /(?:DOB|DATE\s+OF\s+BIRTH|BIRTH\s*DATE)\s*[:]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i
  );
  return m?.[1]?.trim() ?? null;
}

function extractNameFromLabelLine(line: string): string | null {
  const m = line.match(
    /^(?:Reported\s+)?(?:Primary\s+)?(?:Name|Subject\s+Name|Primary\s+Subject|Reported\s+Name)\s*[:#]\s*(.+)$/i
  );
  if (m?.[1]) {
    const n = normalizeName(m[1]);
    if (n.length >= 2 && n.length <= 120 && !/^[\d\s./-]+$/.test(n)) {
      return n;
    }
  }
  return null;
}

function findSubjectBlockRanges(lines: string[]): { start: number; end: number }[] {
  const blocks: { start: number; end: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lineHasSubjectMarker(lines[i])) {
      const start = i;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lineHasSubjectMarker(lines[j])) {
          end = j;
          break;
        }
      }
      blocks.push({ start, end });
      i = end - 1;
    }
  }
  return blocks;
}

// --- Global noise / confidence ------------------------------------------------

const NOISE_START_RE =
  /^(?:page|report|run|search|order|reference|transaction|file|case|copyright|©|tlo|transunion|experian)\b/i;

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2) {
    return true;
  }
  if (/https?:\/\//i.test(t) || t.includes("@")) {
    return true;
  }
  if (NOISE_START_RE.test(t)) {
    return true;
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 10 && PHONE_RE.test(t)) {
    return true;
  }
  return false;
}

/** 2–4 ALL-CAPS words, typical TLO subject / relative names. */
function isAllCapsNameWords(line: string): boolean {
  const t = line.trim();
  if (t.length < 5 || t.length > 85) {
    return false;
  }
  if (/^\d/.test(t)) {
    return false;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) {
    return false;
  }
  for (const w of words) {
    if (!/^[A-Z][A-Z'.-]*$/.test(w)) {
      return false;
    }
  }
  if (isStreetLine(t)) {
    return false;
  }
  return true;
}

function isTitleCaseNameLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 5 || t.length > 90) {
    return false;
  }
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}$/.test(t);
}

function makePerson(fullName: string, dob: string | null): ExtractedPerson {
  return {
    id: id(),
    report_id: PLACEHOLDER_REPORT,
    source_id: null,
    full_name: fullName.slice(0, 120),
    dob,
    aliases: [],
    include_in_report: true,
  };
}

function dedupePeople(rows: ExtractedPerson[]): ExtractedPerson[] {
  const seen = new Set<string>();
  const out: ExtractedPerson[] = [];
  for (const p of rows) {
    const k = p.full_name.toUpperCase().replace(/\s+/g, " ");
    if (seen.has(k) || out.length >= 32) {
      continue;
    }
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** A: labeled names, ALL CAPS / title names near "Subject N of M", and DOB/Age following lines. */
function extractPeopleGlobal(lines: string[]): ExtractedPerson[] {
  const found: ExtractedPerson[] = [];

  for (let i = 0; i < lines.length; i++) {
    const labeled = extractNameFromLabelLine(lines[i]);
    if (labeled) {
      let dob: string | null = null;
      for (let k = i; k < Math.min(i + 4, lines.length); k++) {
        const d = extractDobFromLine(lines[k]);
        if (d) {
          dob = d;
          break;
        }
      }
      found.push(makePerson(labeled, dob));
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (!lineHasSubjectMarker(lines[i])) {
      continue;
    }
    let dob: string | null = null;
    for (let j = i + 1; j < Math.min(i + 18, lines.length); j++) {
      const line = lines[j].trim();
      if (!line) {
        continue;
      }
      const d = extractDobFromLine(line);
      if (d) {
        dob = d;
      }
      const lab = extractNameFromLabelLine(line);
      if (lab) {
        found.push(makePerson(lab, dob));
        break;
      }
      if (isNoiseLine(line)) {
        continue;
      }
      if (lineLooksLikeSectionHeader(line) && !isAllCapsNameWords(line) && !isTitleCaseNameLine(line)) {
        continue;
      }
      if (isAllCapsNameWords(line) || isTitleCaseNameLine(line)) {
        found.push(makePerson(line, dob));
        break;
      }
    }
  }

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const next = lines[i + 1].trim();
    if (!line || line.length > 100 || isNoiseLine(line)) {
      continue;
    }
    const hasDobNext =
      /\b(?:DOB|DATE\s+OF\s+BIRTH|Age)\b/i.test(next) ||
      /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(next) ||
      /\bAge\s*:\s*\d+/.test(next);
    if (!hasDobNext) {
      continue;
    }
    if (!(isAllCapsNameWords(line) || isTitleCaseNameLine(line))) {
      continue;
    }
    const dob = extractDobFromLine(next) ?? extractDobFromLine(line);
    found.push(makePerson(line, dob));
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (isNoiseLine(line) || extractNameFromLabelLine(lines[i])) {
      continue;
    }
    if (isAllCapsNameWords(line)) {
      found.push(makePerson(line, null));
    }
  }

  return dedupePeople(found);
}

// --- Addresses: single-line "street, city, ST ZIP" anywhere + two-line pairs ----

/** Embedded or standalone: number + street fragment, city, state zip */
const SINGLE_LINE_ADDR_RE =
  /\b(\d{1,6}\s+[A-Za-z0-9#][^,\n]{1,85}?),\s*([A-Za-z][A-Za-z\s'.-]{1,45}),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/g;

function extractAddressesSingleLine(text: string): ExtractedAddress[] {
  const out: ExtractedAddress[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(SINGLE_LINE_ADDR_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const street = normalizeName(m[1]);
    const city = normalizeName(m[2]);
    const state = m[3];
    const zip = m[4];
    if (street.length < 4 || city.length < 2) {
      continue;
    }
    if (/\bAge\s*:/i.test(street)) {
      continue;
    }
    if (/^\d{1,2}\s+Flat\b/i.test(street)) {
      continue;
    }
    const key = `${street}|${city}|${state}|${zip}`;
    if (seen.has(key) || out.length >= 50) {
      continue;
    }
    seen.add(key);
    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      label: null,
      street,
      city,
      state,
      zip,
      date_range_text: null,
      include_in_report: true,
    });
  }
  return out;
}

function extractAddressesFromLines(
  lines: string[],
  defaultLabel: string | null
): ExtractedAddress[] {
  const out: ExtractedAddress[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length - 1; ) {
    const rawStreet = lines[i];
    if (isCurrentOtherPhonesAtAddressLine(rawStreet)) {
      i++;
      continue;
    }
    let street = rawStreet.trim();
    let nextIdx = i + 1;
    let cityLine = lines[nextIdx]?.trim() ?? "";
    if (
      !parseCityStateZipLine(cityLine) &&
      isUnitContinuationLine(lines[nextIdx] ?? "") &&
      nextIdx + 1 < lines.length
    ) {
      street = `${street} ${lines[nextIdx].trim()}`.trim();
      nextIdx++;
      cityLine = lines[nextIdx]?.trim() ?? "";
    }
    if (isCurrentOtherPhonesAtAddressLine(cityLine)) {
      i++;
      continue;
    }
    const parsed = parseCityStateZipLine(cityLine);
    if (!parsed) {
      i++;
      continue;
    }
    if (!isStreetLine(street)) {
      i++;
      continue;
    }
    const { city, state, zip } = parsed;
    const key = `${street}|${city}|${state}|${zip}`;
    if (seen.has(key) || out.length >= 50) {
      i++;
      continue;
    }
    seen.add(key);

    let label = defaultLabel;
    let dateRange: string | null = null;
    const prev = lines[i - 1]?.trim() ?? "";
    if (prev && DATE_RANGE_HINT_RE.test(prev) && !isStreetLine(prev)) {
      dateRange = prev.slice(0, 200);
    }
    if (prev && /^(?:Mailing|Physical|Current|Previous|Former)\b/i.test(prev)) {
      label = prev.slice(0, 120);
    }

    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      label,
      street,
      city,
      state,
      zip,
      date_range_text: dateRange,
      include_in_report: true,
    });
    i = nextIdx + 1;
  }

  return out;
}

function dedupeAddresses(rows: ExtractedAddress[]): ExtractedAddress[] {
  const seen = new Set<string>();
  const out: ExtractedAddress[] = [];
  for (const a of rows) {
    const k = `${a.street}|${a.city}|${a.state}|${a.zip}`.toUpperCase();
    if (seen.has(k) || out.length >= 60) {
      continue;
    }
    seen.add(k);
    out.push(a);
  }
  return out;
}

function extractAddressesGlobal(text: string, lines: string[]): ExtractedAddress[] {
  const single = extractAddressesSingleLine(text);
  const filtered = lines.filter((l) => !isCurrentOtherPhonesAtAddressLine(l));
  const twoLine = extractAddressesFromLines(filtered, null);
  return dedupeAddresses([...single, ...twoLine]);
}

// --- Associates: name + birth year + Age, or name + Age -----------------------

const NAME_YEAR_AGE_RE =
  /^(.+?)\s+(\d{4})\s+Age\s*:\s*\d+/i;

const NAME_AGE_ONLY_RE = /^(.+?)\s+Age\s*:\s*\d+/i;

function cleanAssociateName(raw: string): string | null {
  const n = normalizeName(raw);
  if (n.length < 4 || n.length > 120) {
    return null;
  }
  if (/\d{3}-\d{4}/.test(n) || PHONE_RE.test(n)) {
    return null;
  }
  if (isStreetLine(n)) {
    return null;
  }
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return null;
  }
  return n.slice(0, 200);
}

function extractAssociatesGlobal(lines: string[]): ExtractedAssociate[] {
  const out: ExtractedAssociate[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length > 220) {
      continue;
    }
    if (isNoiseLine(line)) {
      continue;
    }

    let m = line.match(NAME_YEAR_AGE_RE);
    if (m?.[1]) {
      const name = cleanAssociateName(m[1]);
      if (name) {
        const key = name.toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            id: id(),
            report_id: PLACEHOLDER_REPORT,
            source_id: null,
            name,
            relationship_label: null,
            include_in_report: true,
          });
        }
      }
      if (out.length >= 40) {
        break;
      }
      continue;
    }

    m = line.match(NAME_AGE_ONLY_RE);
    if (m?.[1]) {
      const name = cleanAssociateName(m[1]);
      if (name) {
        const key = name.toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            id: id(),
            report_id: PLACEHOLDER_REPORT,
            source_id: null,
            name,
            relationship_label: null,
            include_in_report: true,
          });
        }
      }
    }
    if (out.length >= 40) {
      break;
    }
  }

  return out;
}

// --- Phones (existing: section headers + subject-block fallback) --------------

function phoneConfidenceRank(t: string | null): number {
  if (!t) {
    return 0;
  }
  const u = t.toUpperCase();
  if (u.includes("HIGH")) {
    return 3;
  }
  if (u.includes("MEDIUM")) {
    return 2;
  }
  if (u.includes("LOW")) {
    return 1;
  }
  return 0;
}

function parsePhoneLine(line: string): ExtractedPhone[] {
  if (isCurrentOtherPhonesAtAddressLine(line)) {
    return [];
  }
  const matches = line.match(PHONE_RE) ?? [];
  const out: ExtractedPhone[] = [];
  const conf =
    line.match(/\((High|Medium|Low)\)|\b(High|Medium|Low)\s+confidence\b/i)?.[1] ??
    line.match(/\b(High|Medium|Low)\b/i)?.[1];
  const typeLabel = conf
    ? `Possible phone (${conf} confidence)`
    : "Possible phone";

  for (const raw of matches) {
    const key = normalizePhoneDigits(raw);
    if (key.length !== 10) {
      continue;
    }
    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      phone_number: raw.trim(),
      phone_type: typeLabel,
      include_in_report: true,
    });
  }
  return out;
}

function dedupePhonesPreferConfidence(phones: ExtractedPhone[]): ExtractedPhone[] {
  const byDigit = new Map<string, ExtractedPhone>();
  for (const p of phones) {
    const k = normalizePhoneDigits(p.phone_number);
    if (k.length !== 10) {
      continue;
    }
    const existing = byDigit.get(k);
    if (
      !existing ||
      phoneConfidenceRank(p.phone_type) > phoneConfidenceRank(existing.phone_type)
    ) {
      byDigit.set(k, p);
    }
  }
  return [...byDigit.values()];
}

const PHONE_SECTION_PATTERNS: RegExp[] = [
  /(?:^|\n)\s*Possible\s+Phones?\b/gi,
  /(?:^|\n)\s*(?:Wireless|Cell|Mobile)\s+Phones?\b/gi,
  /(?:^|\n)\s*Phone\s+(?:Numbers?|Summary|List)\b/gi,
  /(?:^|\n)\s*Listed\s+Phones?\b/gi,
  /(?:^|\n)\s*Current\s+Phones?\b/gi,
];

function extractPhones(text: string): ExtractedPhone[] {
  const collected: ExtractedPhone[] = [];
  for (const pattern of PHONE_SECTION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const after = text.slice(m.index + m[0].length);
      const chunk = takeSectionChunk(after, 8000);
      for (const line of chunk.split("\n")) {
        if (isCurrentOtherPhonesAtAddressLine(line)) {
          continue;
        }
        collected.push(...parsePhoneLine(line));
      }
    }
  }

  if (collected.length > 0) {
    return dedupePhonesPreferConfidence(collected).slice(0, 80);
  }

  const lines = text.split("\n");
  const blocks = findSubjectBlockRanges(lines);

  for (const { start, end } of blocks) {
    for (let i = start; i < end; i++) {
      const line = lines[i];
      if (isCurrentOtherPhonesAtAddressLine(line)) {
        continue;
      }
      if (
        /\b(?:Phone|Mobile|Wireless|Cell)\b/i.test(line) ||
        /(?:\+1[-.\s]?)?(?:\(?\d{3}\)[-.\s]?|\d{3}[-.\s]?)\d{3}[-.\s]?\d{4}/.test(
          line
        )
      ) {
        collected.push(...parsePhoneLine(line));
      }
    }
  }

  return dedupePhonesPreferConfidence(collected).slice(0, 80);
}

// --- Vehicles (strict, unchanged intent) --------------------------------------

const YMM_NOISE_RE =
  /\b(?:report|statement|invoice|fee|total|account|page|section|copyright|annual|balance|payment)\b/i;

const VEHICLE_CONTEXT_RE =
  /\b(?:plate|licen[sc]e|reg\.?|registration|title|vin|vehicle|auto|motor)\b/i;

function extractYmmStrictLines(section: string): ExtractedVehicle[] {
  const out: ExtractedVehicle[] = [];
  const lineRe =
    /^(?:19|20)\d{2}\s+[A-Za-z][A-Za-z-]{1,24}\s+[A-Za-z0-9][A-Za-z0-9\s-]{1,36}$/;
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (line.length < 10 || line.length > 90) {
      continue;
    }
    if (YMM_NOISE_RE.test(line)) {
      continue;
    }
    if (!lineRe.test(line)) {
      continue;
    }
    const shortYmmCandidate =
      line.length <= 72 &&
      line.split(/\s+/).length <= 8 &&
      !YMM_NOISE_RE.test(line);
    if (!VEHICLE_CONTEXT_RE.test(line) && !shortYmmCandidate) {
      continue;
    }
    const parts = line.split(/\s+/);
    const year = parts[0];
    const make = parts[1] ?? null;
    const model = parts.slice(2).join(" ") || null;
    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      year,
      make,
      model,
      vin: null,
      plate: null,
      state: null,
      include_in_report: true,
    });
    if (out.length >= 15) {
      break;
    }
  }
  return out;
}

function extractVinFromText(section: string): ExtractedVehicle[] {
  const out: ExtractedVehicle[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VIN_RE);
  while ((m = re.exec(section)) !== null) {
    const vin = m[1].toUpperCase();
    if (seen.has(vin)) {
      continue;
    }
    seen.add(vin);
    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      year: null,
      make: null,
      model: null,
      vin,
      plate: null,
      state: null,
      include_in_report: true,
    });
    if (out.length >= 20) {
      break;
    }
  }
  return out;
}

function sliceVehicleSection(text: string): string | null {
  const m = text.match(
    /(?:^|\n)\s*(?:Vehicle|Vehicles|Vehicle\s+Summary|Registered\s+Vehicles?|Motor\s+Vehicles?|AUTO\s+RECORD)\b/i
  );
  if (!m || m.index === undefined) {
    return null;
  }
  return takeSectionChunk(text.slice(m.index + m[0].length), 12000);
}

function extractVehicles(text: string): ExtractedVehicle[] {
  const vehSection = sliceVehicleSection(text);
  const out: ExtractedVehicle[] = [];
  if (vehSection) {
    out.push(...extractVinFromText(vehSection));
    out.push(...extractYmmStrictLines(vehSection));
  }

  const seenVin = new Set<string>();
  const deduped: ExtractedVehicle[] = [];
  for (const v of out) {
    if (v.vin) {
      if (seenVin.has(v.vin)) {
        continue;
      }
      seenVin.add(v.vin);
    }
    deduped.push(v);
  }
  return deduped.slice(0, 25);
}

function extractEmploymentGlobal(text: string): ExtractedEmployment[] {
  const out: ExtractedEmployment[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.length < 5 || t.length > 220) {
      continue;
    }
    const labeled =
      t.match(
        /^(?:Employer|Company|Organization)\s*[:#]\s*(.+?)(?:\s+[-–—]\s*(.+))?$/i
      ) ??
      t.match(/^Position\s*[:#]\s*(.+)$/i) ??
      t.match(/^Title\s*[:#]\s*(.+)$/i);
    if (labeled) {
      const employer = labeled[1]?.trim() ?? "";
      const role = labeled[2]?.trim() ?? null;
      if (employer.length > 2 && /[A-Za-z]/.test(employer)) {
        out.push({
          id: id(),
          report_id: PLACEHOLDER_REPORT,
          source_id: null,
          employer_name: employer.slice(0, 200),
          role_title: role,
          include_in_report: true,
        });
      }
    }
    if (out.length >= 20) {
      break;
    }
  }
  return out;
}

/**
 * TLO parse: independent global detectors over line stream (no primary reliance on section blocks).
 * Phones / vehicles reuse section helpers where helpful; addresses also match inline "st, city, ST zip".
 */
export function parseTlo(rawText: string): ExtractedData {
  const text = normalizeExtractedText(rawText);
  const lines = text.split("\n");

  const people = extractPeopleGlobal(lines);
  const addresses = extractAddressesGlobal(text, lines);
  const associates = extractAssociatesGlobal(lines);
  const phones = extractPhones(text);
  const vehicles = extractVehicles(text);
  const employment = extractEmploymentGlobal(text);

  return {
    people,
    addresses,
    phones,
    vehicles,
    associates,
    employment,
  };
}
