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

/** TLO often appends "(MM/DD/YYYY to MM/DD/YYYY)" after ZIP on the city line. */
function stripTrailingStrictAddressDateRange(line: string): string {
  let t = line.trim();
  const parenAtEnd =
    /\s*\(\d{2}\/\d{2}\/\d{4}\s+to\s+\d{2}\/\d{2}\/\d{4}\)\s*$/i;
  const plainAtEnd =
    /\s+\d{2}\/\d{2}\/\d{4}\s+to\s+\d{2}\/\d{2}\/\d{4}\s*$/i;
  if (parenAtEnd.test(t)) {
    t = t.replace(parenAtEnd, "").trim();
  } else if (plainAtEnd.test(t)) {
    t = t.replace(plainAtEnd, "").trim();
  }
  return t;
}

function parseCityStateZipLine(
  line: string
): { city: string; state: string; zip: string } | null {
  const variants: string[] = [];
  const trimmed = line.trim();
  variants.push(trimmed);
  const stripped = stripTrailingStrictAddressDateRange(line);
  if (stripped !== trimmed) {
    variants.push(stripped);
  }
  for (const t of variants) {
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

type PersonIdentityFields = {
  dob?: string | null;
  ssn?: string | null;
  drivers_license_number?: string | null;
  drivers_license_state?: string | null;
};

function makePerson(fullName: string, identity: PersonIdentityFields = {}): ExtractedPerson {
  return {
    id: id(),
    report_id: PLACEHOLDER_REPORT,
    source_id: null,
    full_name: fullName.slice(0, 120),
    dob: identity.dob ?? null,
    ssn: identity.ssn ?? null,
    drivers_license_number: identity.drivers_license_number ?? null,
    drivers_license_state: identity.drivers_license_state ?? null,
    aliases: [],
    include_in_report: true,
  };
}

function mergePersonIdentity(a: ExtractedPerson, b: ExtractedPerson): ExtractedPerson {
  return {
    ...a,
    dob: a.dob ?? b.dob,
    ssn: a.ssn ?? b.ssn,
    drivers_license_number: a.drivers_license_number ?? b.drivers_license_number,
    drivers_license_state: a.drivers_license_state ?? b.drivers_license_state,
    aliases: [...new Set([...(a.aliases ?? []), ...(b.aliases ?? [])])],
  };
}

function dedupePeople(rows: ExtractedPerson[]): ExtractedPerson[] {
  const byKey = new Map<string, ExtractedPerson>();
  for (const p of rows) {
    const k = p.full_name.toUpperCase().replace(/\s+/g, " ");
    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, p);
      continue;
    }
    byKey.set(k, mergePersonIdentity(existing, p));
  }
  return [...byKey.values()].slice(0, 32);
}

/**
 * Full line after colon — not limited to 4 ALL-CAPS tokens (long / compound names).
 * Stops at "(" so trailing (dates) on the same line is not part of the name.
 */
const SUBJECT_COLON_NAME_RE =
  /Subject\s+\d+\s+of\s+\d+\s*:\s*([^\n(]+)/gi;

function isRejectedPersonName(name: string): boolean {
  const t = name.trim();
  if (t.length < 3) {
    return true;
  }
  if (/\b(?:Report|Page|License)\b/i.test(t)) {
    return true;
  }
  const words = t.split(/\s+/).filter(Boolean);
  return words.length > 8;
}

/** Strip report junk that sometimes follows the name on the same line. */
function cleanLooseSubjectName(raw: string): string {
  let t = normalizeName(raw);
  t = t.replace(/\s+(?:Page|Report)\s+\d+.*$/i, "").trim();
  t = t.replace(
    /\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]\s*\d{1,2}\/\d{1,2}\/\d{2,4}.*$/i,
    ""
  ).trim();
  t = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return t.slice(0, 120);
}

function extractPeopleFromSubjectColonPattern(text: string): ExtractedPerson[] {
  const out: ExtractedPerson[] = [];
  const re = new RegExp(SUBJECT_COLON_NAME_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]?.trim() ?? "";
    const name = cleanLooseSubjectName(raw.replace(/\s+/g, " "));
    if (!name || isRejectedPersonName(name)) {
      continue;
    }
    out.push(makePerson(name, {}));
  }
  return out;
}

function extractNameFromSubjectBlockFirstLine(line: string): string | null {
  const m = line.match(/Subject\s+\d+\s+of\s+\d+\s*:\s*([A-Z][A-Z\s\-']*)/i);
  if (m?.[1]) {
    const name = normalizeName(m[1]);
    if (!name || isRejectedPersonName(name)) {
      return null;
    }
    return name;
  }
  const loose = line.match(/\bSubject\s+\d+\s+of\s+\d+\s*:\s*(.+)$/i);
  if (loose?.[1]) {
    const name = cleanLooseSubjectName(loose[1]);
    if (name.length >= 2 && !isRejectedPersonName(name)) {
      return name;
    }
  }
  return null;
}

/**
 * Subject header may wrap across lines or include extra tokens; try first few lines + merged.
 */
function extractSubjectNameFromBlockLines(blockLines: string[]): string | null {
  const tryLine = (line: string): string | null => {
    const t = line.trim();
    if (!t) {
      return null;
    }
    const strict = extractNameFromSubjectBlockFirstLine(t);
    if (strict) {
      return strict;
    }
    const loose = t.match(/\bSubject\s+\d+\s+of\s+\d+\s*:\s*(.+)$/i);
    if (loose?.[1]) {
      const n = cleanLooseSubjectName(loose[1]);
      if (n.length >= 2 && !isRejectedPersonName(n)) {
        return n;
      }
    }
    return null;
  };

  for (let i = 0; i < Math.min(4, blockLines.length); i++) {
    const n = tryLine(blockLines[i] ?? "");
    if (n) {
      return n;
    }
  }

  const merged = [blockLines[0], blockLines[1]].filter(Boolean).join(" ").trim();
  if (merged.length > 12 && /\bSubject\s+\d+\s+of\s+\d+\b/i.test(merged)) {
    return tryLine(merged);
  }
  return null;
}

/**
 * Identity lines scoped to one subject block (between Subject markers).
 * Sample labels: DOB 09/29/1985, SSN 326-71-0673, DL# T65354185277, DL State IL
 */
function extractIdentityFromSubjectBlockText(blockText: string): PersonIdentityFields {
  let dob: string | null = null;
  const lines = blockText.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    const d = extractDobFromLine(line);
    if (d) {
      dob = d;
      break;
    }
  }
  if (!dob) {
    for (const raw of lines) {
      const line = raw.trim();
      const alone = line.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/);
      if (alone?.[1]) {
        dob = alone[1];
        break;
      }
    }
  }

  let ssn: string | null = null;
  const ssnLabeled = blockText.match(
    /(?:SSN|Social\s+Security)\s*#?\s*:?\s*(\d{3}-\d{2}-\d{4})/i
  );
  if (ssnLabeled?.[1]) {
    ssn = ssnLabeled[1];
  } else {
    const ssnBare = blockText.match(/\b(\d{3}-\d{2}-\d{4})\b/);
    if (ssnBare?.[1]) {
      ssn = ssnBare[1];
    }
  }

  let drivers_license_number: string | null = null;
  const dlNum = blockText.match(
    /\b(?:DL|D\.?\s*L\.?)\s*#?\s*:?\s*([A-Z0-9]{5,24})\b/i
  );
  if (dlNum?.[1]) {
    drivers_license_number = dlNum[1];
  }

  let drivers_license_state: string | null = null;
  const dlSt = blockText.match(
    /\b(?:DL\s*State|Driver'?s?\s+License\s+State|License\s+State)\s*[:#]?\s*([A-Z]{2})\b/i
  );
  if (dlSt?.[1]) {
    drivers_license_state = dlSt[1];
  }

  return {
    dob: dob ?? undefined,
    ssn: ssn ?? undefined,
    drivers_license_number: drivers_license_number ?? undefined,
    drivers_license_state: drivers_license_state ?? undefined,
  };
}

/** One row per subject block with name + identity fields from that block’s text. */
function extractPeopleFromSubjectBlocks(lines: string[]): ExtractedPerson[] {
  const blocks = findSubjectBlockRanges(lines);
  const out: ExtractedPerson[] = [];
  for (const { start, end } of blocks) {
    const blockLines = lines.slice(start, end);
    if (blockLines.length === 0) {
      continue;
    }
    const name = extractSubjectNameFromBlockLines(blockLines);
    if (!name) {
      continue;
    }
    const blockText = blockLines.join("\n");
    const identity = extractIdentityFromSubjectBlockText(blockText);
    out.push(makePerson(name, identity));
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
      found.push(makePerson(labeled, { dob }));
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
        found.push(makePerson(lab, { dob }));
        break;
      }
      if (isNoiseLine(line)) {
        continue;
      }
      if (lineLooksLikeSectionHeader(line) && !isAllCapsNameWords(line) && !isTitleCaseNameLine(line)) {
        continue;
      }
      if (isAllCapsNameWords(line) || isTitleCaseNameLine(line)) {
        found.push(makePerson(line, { dob }));
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
    found.push(makePerson(line, { dob }));
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (isNoiseLine(line) || extractNameFromLabelLine(lines[i])) {
      continue;
    }
    if (isAllCapsNameWords(line)) {
      found.push(makePerson(line, {}));
    }
  }

  return found;
}

// --- Addresses: single-line "street, city, ST ZIP" anywhere + two-line pairs ----

const MAX_ADDRESS_STREET_CHARS = 120;

/** Strip TLO metadata that sometimes prefixes or embeds in address fragments. */
const ADDRESS_JUNK_PREFIX_RE =
  /^(?:(?:Subdivision\s+Name|Address\s+contains|Address\s*:|(?:\d{4}\s*)?ID\s+Type|DL\s*#?|Reported\s+Address|Location|Parcel|County|FIPS)\s*:\s*)/i;

/** Remove mid-string TLO labels so street/city stay "physical address only" when possible. */
function stripEmbeddedAddressMetadataPhrases(s: string): string {
  let t = s;
  t = t.replace(/\bSubdivision\s+Name\s*:\s*[^,|]+/gi, " ");
  t = t.replace(/\bAddress\s+contains\s*:\s*[^,|]+/gi, " ");
  t = t.replace(/\bOther\s+names?\s+at\s+(?:this\s+)?address\s*:\s*[^,|]+/gi, " ");
  t = t.replace(
    /\b(?:Current\s+)?Other\s+Phones?\s+at\s+address\s*:\s*[^,|]+/gi,
    " "
  );
  t = t.replace(/\bOccupants?\s+at\s+address\s*:\s*[^,|]+/gi, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** Dates sometimes leak before the house number when PDF order is odd. */
function stripLeadingDateGarbageFromAddressFragment(s: string): string {
  let t = s.trim();
  const paren = /^\s*\(\d{2}\/\d{2}\/\d{4}\s+to\s+\d{2}\/\d{2}\/\d{4}\)\s+/i;
  const plain = /^\s*\d{2}\/\d{2}\/\d{4}\s+to\s+\d{2}\/\d{2}\/\d{4}\s+/i;
  for (let k = 0; k < 4 && (paren.test(t) || plain.test(t)); k++) {
    t = t.replace(paren, "").replace(plain, "").trim();
  }
  return t;
}

function cleanAddressField(s: string): string {
  let t = normalizeName(s);
  let prev = "";
  while (t !== prev && t.length > 0) {
    prev = t;
    t = t.replace(ADDRESS_JUNK_PREFIX_RE, "").trim();
  }
  t = stripEmbeddedAddressMetadataPhrases(t);
  t = stripTrailingStrictAddressDateRange(t);
  return t;
}

/** Drop label / boilerplate lines (not physical addresses). Avoids flagging "430 Report Ave". */
function isAddressMetadataLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4) {
    return false;
  }
  const looksLikeStreetStart =
    /^\d{1,6}\s/.test(t) || /^(?:P\.?O\.?\s*BOX|PO\s*BOX)\b/i.test(t);
  if (looksLikeStreetStart) {
    return false;
  }
  return (
    /Subdivision\s+Name/i.test(t) ||
    /Address\s+contains/i.test(t) ||
    /\bPrepared\s+by\b/i.test(t) ||
    /\bReport\b/i.test(t) ||
    /\bPage\b/i.test(t)
  );
}

/** First place that looks like "123 MAIN…" — drops "DL … NAME …" before the number. */
function stripStreetToLeadingNumber(s: string): string {
  const t = normalizeName(s);
  const m = t.match(/\d{1,6}\s+[A-Za-z0-9#]/);
  if (m && m.index !== undefined && m.index > 0) {
    return t.slice(m.index).trim();
  }
  return t;
}

function trimStreetToMaxLength(street: string): string {
  if (street.length <= MAX_ADDRESS_STREET_CHARS) {
    return street;
  }
  const slice = street.slice(0, MAX_ADDRESS_STREET_CHARS);
  const lastComma = slice.lastIndexOf(",");
  if (lastComma > 24) {
    return slice.slice(0, lastComma).trim();
  }
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 24) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

/**
 * Street-only: strip label junk, then snap to the first "123 MAIN…" segment (drops "DL NAME …" before the number).
 */
function cleanAddressStreet(raw: string): string {
  let t = normalizeName(raw);
  let prev = "";
  while (t !== prev && t.length > 0) {
    prev = t;
    t = t.replace(ADDRESS_JUNK_PREFIX_RE, "").trim();
  }
  t = stripLeadingDateGarbageFromAddressFragment(t);
  t = stripEmbeddedAddressMetadataPhrases(t);
  t = stripTrailingStrictAddressDateRange(t);
  t = stripStreetToLeadingNumber(t);
  if (isAddressMetadataLine(t)) {
    return "";
  }
  t = trimStreetToMaxLength(t);
  return t;
}

function isStreetStartsWithNumberOrPoBox(street: string): boolean {
  const t = street.trim();
  if (t.length < 4) {
    return false;
  }
  if (/^(?:P\.?O\.?\s*BOX|PO\s*BOX)\b/i.test(t)) {
    return true;
  }
  return /^\d{1,6}\s/.test(t);
}

/**
 * Strict TLO range: (MM/DD/YYYY to MM/DD/YYYY) or same without outer parens.
 * Per-address only — do not reuse dates from other lines.
 */
const ADDRESS_LINE_DATE_RANGE_STRICT_PAREN_RE =
  /\((\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})\)/i;

const ADDRESS_LINE_DATE_RANGE_STRICT_PLAIN_RE =
  /\b(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})\b/i;

function parseAddressLineDateRange(fullLine: string): {
  date_from: string | null;
  date_to: string | null;
  date_range_text: string | null;
} {
  const t = fullLine.trim();
  if (!t) {
    return { date_from: null, date_to: null, date_range_text: null };
  }
  const parenRe = new RegExp(ADDRESS_LINE_DATE_RANGE_STRICT_PAREN_RE.source, "gi");
  const parenAll = [...t.matchAll(parenRe)];
  const parenLast = parenAll.filter((m) => m[1] && m[2]).pop();
  if (parenLast?.[1] && parenLast[2]) {
    return {
      date_from: parenLast[1],
      date_to: parenLast[2],
      date_range_text: `${parenLast[1]} to ${parenLast[2]}`,
    };
  }
  const plainRe = new RegExp(ADDRESS_LINE_DATE_RANGE_STRICT_PLAIN_RE.source, "gi");
  const plainAll = [...t.matchAll(plainRe)];
  const plainLast = plainAll.filter((m) => m[1] && m[2]).pop();
  if (plainLast?.[1] && plainLast[2]) {
    return {
      date_from: plainLast[1],
      date_to: plainLast[2],
      date_range_text: `${plainLast[1]} to ${plainLast[2]}`,
    };
  }
  return { date_from: null, date_to: null, date_range_text: null };
}

/** Drop dates unless both MM/DD/YYYY parts literally appear in this block (no cross-address reuse). */
function restrictDateRangeToBlockText(
  dr: { date_from: string | null; date_to: string | null; date_range_text: string | null },
  block: string
): { date_from: string | null; date_to: string | null; date_range_text: string | null } {
  if (!dr.date_from || !dr.date_to) {
    return dr;
  }
  const collapsed = block.replace(/\s+/g, " ");
  if (collapsed.includes(dr.date_from) && collapsed.includes(dr.date_to)) {
    return dr;
  }
  return { date_from: null, date_to: null, date_range_text: null };
}

/**
 * Two-line (or street+unit+city): dates only from city line, else street-side lines — never a
 * synthetic join that could pull one shared range for every row.
 */
function parseAddressDateRangeFromBlockLines(
  lines: string[],
  streetIdx: number,
  cityLineIdx: number
): { date_from: string | null; date_to: string | null; date_range_text: string | null } {
  const streetParts: string[] = [];
  for (let k = streetIdx; k < cityLineIdx; k++) {
    streetParts.push(lines[k]?.trim() ?? "");
  }
  const streetRaw = streetParts.join(" ").trim();
  const cityRaw = lines[cityLineIdx]?.trim() ?? "";

  const fromCity = restrictDateRangeToBlockText(parseAddressLineDateRange(cityRaw), cityRaw);
  if (fromCity.date_from) {
    return fromCity;
  }
  const fromStreet = restrictDateRangeToBlockText(
    parseAddressLineDateRange(streetRaw),
    streetRaw
  );
  if (fromStreet.date_from) {
    return fromStreet;
  }
  return { date_from: null, date_to: null, date_range_text: null };
}

/** Embedded or standalone: number + street fragment, city, state zip */
const SINGLE_LINE_ADDR_RE =
  /\b(\d{1,6}\s+[A-Za-z0-9#][^,\n]{1,85}?),\s*([A-Za-z][A-Za-z\s'.-]{1,45}),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/g;

function extractAddressesSingleLine(text: string): ExtractedAddress[] {
  const out: ExtractedAddress[] = [];
  const seen = new Set<string>();
  const re = new RegExp(SINGLE_LINE_ADDR_RE.source, "g");
  const allMatches = [...text.matchAll(re)];

  for (let idx = 0; idx < allMatches.length; idx++) {
    const m = allMatches[idx] as RegExpExecArray;
    const mIndex = m.index ?? 0;
    const street = cleanAddressStreet(m[1]);
    if (!street || !isStreetStartsWithNumberOrPoBox(street)) {
      continue;
    }
    const city = cleanAddressField(m[2]);
    if (!city || city.length < 2 || isAddressMetadataLine(city)) {
      continue;
    }
    const state = m[3];
    const zip = m[4];
    if (/\bAge\s*:/i.test(street)) {
      continue;
    }
    if (/^\d{1,2}\s+Flat\b/i.test(street)) {
      continue;
    }
    const key = `${street}|${city}|${state}|${zip}`.replace(/\s+/g, " ").toUpperCase();
    if (seen.has(key) || out.length >= 50) {
      continue;
    }
    seen.add(key);

    const lineStart = text.lastIndexOf("\n", mIndex) + 1;
    const lineEnd = text.indexOf("\n", mIndex);
    const absLineEnd = lineEnd === -1 ? text.length : lineEnd;
    const nextM = allMatches[idx + 1];
    const blockEnd =
      nextM &&
      (nextM.index ?? 0) >= mIndex &&
      (nextM.index ?? 0) < absLineEnd
        ? (nextM.index ?? 0)
        : absLineEnd;
    const addressBlockText = text.slice(mIndex, blockEnd);
    const dr = restrictDateRangeToBlockText(
      parseAddressLineDateRange(addressBlockText),
      addressBlockText
    );

    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      label: null,
      street,
      city,
      state,
      zip,
      date_range_text: dr.date_range_text,
      date_from: dr.date_from,
      date_to: dr.date_to,
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
    const rawTrim = rawStreet.trim();
    if (isAddressMetadataLine(rawTrim)) {
      i++;
      continue;
    }
    let street = rawTrim;
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
    if (isAddressMetadataLine(cityLine)) {
      i++;
      continue;
    }
    street = cleanAddressStreet(street);
    if (!street || !isStreetStartsWithNumberOrPoBox(street)) {
      i++;
      continue;
    }
    const parsed = parseCityStateZipLine(cityLine);
    if (!parsed) {
      i++;
      continue;
    }
    const city = cleanAddressField(parsed.city);
    if (!city || isAddressMetadataLine(city)) {
      i++;
      continue;
    }
    const { state, zip } = parsed;
    const key = `${street}|${city}|${state}|${zip}`.replace(/\s+/g, " ").toUpperCase();
    if (seen.has(key) || out.length >= 50) {
      i++;
      continue;
    }
    seen.add(key);

    let label = defaultLabel;
    const labelPrev = lines[i - 1]?.trim() ?? "";
    if (labelPrev && /^(?:Mailing|Physical|Current|Previous|Former)\b/i.test(labelPrev)) {
      label = labelPrev.slice(0, 120);
    }

    const drLine = parseAddressDateRangeFromBlockLines(lines, i, nextIdx);

    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      label,
      street,
      city,
      state,
      zip,
      date_range_text: drLine.date_range_text,
      date_from: drLine.date_from,
      date_to: drLine.date_to,
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
    const k = `${a.street}|${a.city}|${a.state}|${a.zip}`
      .replace(/\s+/g, " ")
      .toUpperCase();
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
  const filtered = lines.filter(
    (l) => !isCurrentOtherPhonesAtAddressLine(l) && !isAddressMetadataLine(l)
  );
  const twoLine = extractAddressesFromLines(filtered, null);
  return dedupeAddresses([...single, ...twoLine]);
}

// --- Associates: name + birth year + Age, or name + Age -----------------------

/** Title-case names: "Ana Elsa Trinidad 1973 Age: 53" (hyphenated surnames ok) */
const RELATIVE_TITLECASE_YEAR_AGE_RE =
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+(?:-[A-Za-z][a-z]*)?){1,3})\s+\d{4}\s+Age:\s+\d+/i;

/**
 * TLO relative rows: 2–6 name tokens (letters / hyphen / apostrophe), birth year, Age.
 * Used after scrubbing "Possible Relatives" so names are not conflated with headers.
 */
const RELATIVE_ENTRY_RE =
  /\b([A-Za-z][A-Za-z'\-.'’]*(?:\s+[A-Za-z][A-Za-z'\-.'’]*){1,5})\s+([12]\d{3})\s+Age:\s*(\d{1,3})\b/gi;

const RELATIVES_SECTION_HEADER_RES: RegExp[] = [
  /\bPossible\s+Relatives?\b/gi,
  /\bKnown\s+Relatives?\b/gi,
];

const BAD_RELATIVE_NAME_STARTS = new Set([
  "possible",
  "known",
  "relative",
  "relatives",
  "page",
  "subject",
  "address",
  "phone",
  "phones",
  "vehicle",
  "vehicles",
  "employment",
  "employer",
  "employers",
  "current",
  "previous",
  "mailing",
  "residential",
  "report",
  "search",
  "social",
  "security",
  "license",
  "driver",
]);

const MONTH_WORDS = new Set([
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

const NAME_YEAR_AGE_RE =
  /^(.+?)\s+(\d{4})\s+Age\s*:\s*\d+/i;

const NAME_AGE_ONLY_RE = /^(.+?)\s+Age\s*:\s*\d+/i;

/** Flattened PDF often embeds "Possible Relatives" on the same line as the first row. */
function scrubRelativesHeaderPhrases(s: string): string {
  return s.replace(/\b(?:Possible|Known)\s+Relatives?\b/gi, " ");
}

function isPlausibleRelativeBirthYear(y: number): boolean {
  return y >= 1900 && y <= 2090;
}

function isBadRelativeNameStart(firstWord: string): boolean {
  const w = firstWord.toLowerCase().replace(/[^a-z]/g, "");
  return w.length > 0 && BAD_RELATIVE_NAME_STARTS.has(w);
}

function isRelativeNameNoise(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 4) {
    return true;
  }
  const parts = t.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (isBadRelativeNameStart(first)) {
    return true;
  }
  if (MONTH_WORDS.has(first.toLowerCase())) {
    return true;
  }
  return false;
}

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

function dedupeAssociates(rows: ExtractedAssociate[]): ExtractedAssociate[] {
  const seen = new Set<string>();
  const out: ExtractedAssociate[] = [];
  for (const row of rows) {
    const key = row.name.replace(/\s+/g, " ").toUpperCase();
    if (seen.has(key) || out.length >= 40) {
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return out;
}

function pushAssociateFromName(
  nameRaw: string,
  seen: Set<string>,
  out: ExtractedAssociate[]
): void {
  const name = cleanAssociateName(nameRaw);
  if (!name || isRelativeNameNoise(name)) {
    return;
  }
  const key = name.toUpperCase();
  if (seen.has(key) || out.length >= 40) {
    return;
  }
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

/**
 * All `Name … YYYY Age: NN` occurrences in text (flattened multi-entry lines ok).
 */
function collectRelativeEntriesFromText(src: string, seen: Set<string>, out: ExtractedAssociate[]): void {
  const scrubbed = scrubRelativesHeaderPhrases(src);
  const re = new RegExp(RELATIVE_ENTRY_RE.source, RELATIVE_ENTRY_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(scrubbed)) !== null) {
    const year = parseInt(m[2] ?? "", 10);
    if (!isPlausibleRelativeBirthYear(year)) {
      continue;
    }
    const rawName = m[1]?.trim() ?? "";
    if (isRelativeNameNoise(rawName)) {
      continue;
    }
    pushAssociateFromName(rawName, seen, out);
  }
}

function extractAssociatesFromRelativesSections(text: string): ExtractedAssociate[] {
  const out: ExtractedAssociate[] = [];
  const seen = new Set<string>();

  for (const headerRe of RELATIVES_SECTION_HEADER_RES) {
    const r = new RegExp(headerRe.source, headerRe.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const after = text.slice(m.index + m[0].length);
      const chunk = takeSectionChunk(after, 12000);
      if (chunk.length > 0) {
        collectRelativeEntriesFromText(chunk, seen, out);
      }
    }
  }

  return out;
}

/**
 * Same-line and split-line fallbacks outside explicit section headers.
 */
function extractAssociatesFromLines(lines: string[]): ExtractedAssociate[] {
  const out: ExtractedAssociate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (!line || line.length > 500) {
      continue;
    }
    if (isNoiseLine(line)) {
      continue;
    }

    collectRelativeEntriesFromText(line, seen, out);
    if (out.length >= 40) {
      break;
    }

    const relTc = line.match(RELATIVE_TITLECASE_YEAR_AGE_RE);
    if (relTc?.[1]) {
      pushAssociateFromName(relTc[1], seen, out);
      if (out.length >= 40) {
        break;
      }
      continue;
    }

    const scrubbed = scrubRelativesHeaderPhrases(line);
    let m = scrubbed.match(NAME_YEAR_AGE_RE);
    if (m?.[1]) {
      pushAssociateFromName(m[1], seen, out);
      if (out.length >= 40) {
        break;
      }
      continue;
    }

    m = scrubbed.match(NAME_AGE_ONLY_RE);
    if (m?.[1]) {
      pushAssociateFromName(m[1], seen, out);
    }

    const next = lines[i + 1]?.trim() ?? "";
    const yearAge = next.match(/^([12]\d{3})\s+Age:\s*(\d{1,3})\s*$/i);
    if (yearAge) {
      const y = parseInt(yearAge[1] ?? "", 10);
      if (isPlausibleRelativeBirthYear(y) && /^[A-Za-z]/.test(line) && !/\d{4}/.test(line)) {
        pushAssociateFromName(line, seen, out);
      }
    }

    if (out.length >= 40) {
      break;
    }
  }

  return out;
}

function extractAssociatesGlobal(lines: string[], text: string): ExtractedAssociate[] {
  return dedupeAssociates([
    ...extractAssociatesFromRelativesSections(text),
    ...extractAssociatesFromLines(lines),
  ]);
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

/** Mobile > VoIP > LandLine for sorting and dedupe ties. */
function phoneTypePriorityRank(t: string | null): number {
  if (!t) {
    return 0;
  }
  if (/\bMobile\b/i.test(t)) {
    return 3;
  }
  if (/\bVoIP\b/i.test(t)) {
    return 2;
  }
  if (/\bLandLine\b/i.test(t)) {
    return 1;
  }
  return 0;
}

function hasTloLineTypeLabel(t: string | null): boolean {
  return /\b(Mobile|LandLine|VoIP)\b/i.test(t ?? "");
}

/** Pick the richer duplicate: higher confidence, then type tier, then type + %, then legacy label. */
function isBetterPhoneCandidate(a: ExtractedPhone, b: ExtractedPhone): boolean {
  const ca = a.confidence;
  const cb = b.confidence;
  if (ca != null && cb != null && ca !== cb) {
    return ca > cb;
  }
  if (ca != null && cb == null) {
    return true;
  }
  if (ca == null && cb != null) {
    return false;
  }
  const pa = phoneTypePriorityRank(a.phone_type);
  const pb = phoneTypePriorityRank(b.phone_type);
  if (pa !== pb) {
    return pa > pb;
  }
  const aRich = hasTloLineTypeLabel(a.phone_type) && ca != null;
  const bRich = hasTloLineTypeLabel(b.phone_type) && cb != null;
  if (aRich !== bRich) {
    return aRich;
  }
  return phoneConfidenceRank(a.phone_type) > phoneConfidenceRank(b.phone_type);
}

function parseTloPhoneLineSegments(afterPhone: string): {
  lineKind: string | null;
  confidence: number | null;
} {
  const segment = afterPhone.slice(0, 240);
  const typeM = segment.match(/\((Mobile|LandLine|VoIP)\)/i);
  const pctM = segment.match(/\((\d{1,3})%\)/);
  let confidence: number | null = null;
  if (pctM?.[1]) {
    const n = parseInt(pctM[1], 10);
    if (!Number.isNaN(n)) {
      confidence = Math.min(100, Math.max(0, n));
    }
  }
  return {
    lineKind: typeM?.[1] ?? null,
    confidence,
  };
}

function parsePhoneLine(line: string): ExtractedPhone[] {
  if (isCurrentOtherPhonesAtAddressLine(line)) {
    return [];
  }
  const out: ExtractedPhone[] = [];
  const legacyConf =
    line.match(/\((High|Medium|Low)\)|\b(High|Medium|Low)\s+confidence\b/i)?.[1] ??
    line.match(/\b(High|Medium|Low)\b/i)?.[1];

  const re = new RegExp(PHONE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const raw = m[0];
    const key = normalizePhoneDigits(raw);
    if (key.length !== 10) {
      continue;
    }
    const after = line.slice(m.index + raw.length);
    const nextIdx = after.search(/\(\d{3}\)/);
    const segment = nextIdx >= 0 ? after.slice(0, nextIdx) : after;
    const { lineKind, confidence } = parseTloPhoneLineSegments(segment);

    let phoneType: string | null = lineKind;
    if (!phoneType) {
      phoneType = legacyConf
        ? `Possible phone (${legacyConf} confidence)`
        : "Possible phone";
    }

    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      phone_number: raw.trim(),
      phone_type: phoneType,
      confidence,
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
    if (!existing || isBetterPhoneCandidate(p, existing)) {
      byDigit.set(k, p);
    }
  }
  return [...byDigit.values()];
}

const MIN_PHONE_CONFIDENCE_PCT = 40;
const MAX_PHONES_RETURNED = 10;
/** Two-subject TLO reports often have >10 quality lines; don't drop the second subject's phones. */
const MAX_PHONES_MULTI_SUBJECT = 20;

/** Dedupe, then filter to confidence >= 40%, sort, cap (higher cap when multiple subjects). */
function finalizeExtractedPhones(
  phones: ExtractedPhone[],
  maxPhones: number = MAX_PHONES_RETURNED
): ExtractedPhone[] {
  const deduped = dedupePhonesPreferConfidence(phones);
  const filtered = deduped.filter(
    (p) => p.confidence != null && p.confidence >= MIN_PHONE_CONFIDENCE_PCT
  );
  filtered.sort((a, b) => {
    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (cb !== ca) {
      return cb - ca;
    }
    const pa = phoneTypePriorityRank(a.phone_type);
    const pb = phoneTypePriorityRank(b.phone_type);
    if (pb !== pa) {
      return pb - pa;
    }
    return 0;
  });
  return filtered.slice(0, maxPhones);
}

const PHONE_SECTION_PATTERNS: RegExp[] = [
  /(?:^|\n)\s*Possible\s+Phones?\b/gi,
  /(?:^|\n)\s*(?:Wireless|Cell|Mobile)\s+Phones?\b/gi,
  /(?:^|\n)\s*Phone\s+(?:Numbers?|Summary|List)\b/gi,
  /(?:^|\n)\s*Listed\s+Phones?\b/gi,
  /(?:^|\n)\s*Current\s+Phones?\b/gi,
];

/** TLO often prints phones as (708) 408-4328 — scan full text; skip "Other Phones at address" context. */
const PHONE_PAREN_DASH_GLOBAL_RE = /\(\d{3}\)\s*\d{3}-\d{4}/g;

function extractPhonesGlobalParenFormat(text: string): ExtractedPhone[] {
  const out: ExtractedPhone[] = [];
  const seenDigits = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PHONE_PAREN_DASH_GLOBAL_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const idx = m.index;
    const ctxStart = Math.max(0, idx - 160);
    const ctx = text.slice(ctxStart, idx + raw.length);
    if (/Current\s+Other\s+Phones\s+at\s+address/i.test(ctx)) {
      continue;
    }
    const key = normalizePhoneDigits(raw);
    if (key.length !== 10 || seenDigits.has(key)) {
      continue;
    }
    seenDigits.add(key);
    const after = text.slice(idx + raw.length, idx + raw.length + 240);
    const { lineKind, confidence } = parseTloPhoneLineSegments(after);
    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      phone_number: raw.trim(),
      phone_type: lineKind ?? "Possible phone",
      confidence,
      include_in_report: true,
    });
    if (out.length >= 80) {
      break;
    }
  }
  return out;
}

function extractPhones(text: string): ExtractedPhone[] {
  const lines = text.split("\n");
  const subjectBlockCount = findSubjectBlockRanges(lines).length;
  const maxPhones =
    subjectBlockCount >= 2 ? MAX_PHONES_MULTI_SUBJECT : MAX_PHONES_RETURNED;

  const collected: ExtractedPhone[] = [...extractPhonesGlobalParenFormat(text)];

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

  return finalizeExtractedPhones(collected, maxPhones);
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

  const people = dedupePeople([
    ...extractPeopleFromSubjectBlocks(lines),
    ...extractPeopleFromSubjectColonPattern(text),
    ...extractPeopleGlobal(lines),
  ]);
  const addresses = extractAddressesGlobal(text, lines);
  const associates = extractAssociatesGlobal(lines, text);
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
