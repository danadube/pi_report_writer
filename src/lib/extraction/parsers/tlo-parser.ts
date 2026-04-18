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

/** US phone numbers (loose); used only in section-aware contexts — not whole-document scan. */
const PHONE_RE =
  /(?:\+1[-.\s]?)?(?:\(?\d{3}\)[-.\s]?|\d{3}[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

/** 17-char VIN (no I/O/Q). */
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

/** Line starts with "Subject N of M" (TLO); allow trailing text on same line. */
const SUBJECT_LINE_RE = /^\s*Subject\s+\d+\s+of\s+\d+\b/i;

/** PDF text often prefixes the same line ("Page 3 … Subject 1 of 2"). */
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

/** City ST  ZIP (no comma before state) — common in PDF dumps */
const CITY_ST_ZIP_NO_COMMA_RE =
  /^([A-Za-z][A-Za-z\s'.-]+?)\s+([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?\s*$/;

const DATE_RANGE_HINT_RE =
  /\b(?:Present|CURRENT|\d{1,2}\/\d{4}|\d{4})\b.*(?:[-–—]|through|to)\b.*\b(?:Present|CURRENT|\d{1,2}\/\d{4}|\d{4})\b/i;

/** Lines to skip when hunting the first subject name after "Subject N of M". */
const SUBJECT_SKIP_LINE_RE =
  /^(?:Report|Run|Search|Page|Case|File|Date|Time|Order|Reference|Transaction|Record)\b/i;

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

function isLikelyPersonNameLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 100) {
    return false;
  }
  if (/https?:\/\//i.test(t) || t.includes("@")) {
    return false;
  }
  if (/^(?:DOB|SSN|AKA|PHONE|PAGE|SUBJECT|REPORT|RUN\s+DATE)\b/i.test(t)) {
    return false;
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 10 && (PHONE_RE.test(t) || /\(\d{3}\)/.test(t))) {
    return false;
  }
  if (/^\d[\d\s/.-]+$/.test(t) && !/[A-Za-z]{2,}/.test(t)) {
    return false;
  }
  // "LAST, FIRST" or title case / ALL CAPS name tokens
  if (/^[A-Z][A-Z\s,'.-]+$/i.test(t) && /[A-Za-z]/.test(t)) {
    return true;
  }
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(t)) {
    return true;
  }
  if (/^[A-Z][a-z]+,\s*[A-Z]/.test(t)) {
    return true;
  }
  return false;
}

/** Explicit "Name:" style lines common in TLO subject headers */
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

function extractDobFromLine(line: string): string | null {
  const m = line.match(
    /(?:DOB|DATE\s+OF\s+BIRTH|BIRTH\s*DATE)\s*[:]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i
  );
  return m?.[1]?.trim() ?? null;
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

/** Subject N of M blocks: one person per block with primary + aliases (not one person per name line). */
function extractSubjectBlocks(text: string): ExtractedPerson[] {
  const lines = text.split("\n");
  const blocks = findSubjectBlockRanges(lines);

  if (blocks.length === 0) {
    return extractSubjectPersonLegacy(text);
  }

  const people: ExtractedPerson[] = [];
  for (const { start, end } of blocks) {
    const chunk = lines.slice(start, end).join("\n");
    let dob: string | null = null;
    let primary: string | null = null;
    const aliases: string[] = [];
    const aliasSet = new Set<string>();

    const pushAlias = (raw: string) => {
      const n = normalizeName(raw);
      if (!n || n.length < 2) {
        return;
      }
      if (primary && n.toUpperCase() === primary.toUpperCase()) {
        return;
      }
      const key = n.toUpperCase();
      if (aliasSet.has(key)) {
        return;
      }
      aliasSet.add(key);
      aliases.push(n);
    };

    for (const rawLine of lines.slice(start + 1, end)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (/^Possible\s+Relatives\b/i.test(line)) {
        break;
      }
      const inlineDob = extractDobFromLine(line);
      if (inlineDob) {
        dob = inlineDob;
      }
      const labeledName = extractNameFromLabelLine(line);
      if (labeledName) {
        if (!primary) {
          primary = labeledName.slice(0, 120);
        } else {
          pushAlias(labeledName);
        }
        continue;
      }
      const obs = line.match(
        /^(?:Observed\s+Names?|Also\s+Known|AKA|Possible\s+Names?)\s*:?\s*(.+)$/i
      );
      if (obs?.[1]) {
        obs[1]
          .split(/[,;|]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((p) => {
            if (isLikelyPersonNameLine(p)) {
              pushAlias(p);
            }
          });
        continue;
      }
      if (/^(?:DOB|DATE\s+OF\s+BIRTH)\b/i.test(line)) {
        continue;
      }
      if (SUBJECT_SKIP_LINE_RE.test(line)) {
        continue;
      }
      if (lineLooksLikeSectionHeader(line) && !isLikelyPersonNameLine(line)) {
        continue;
      }
      if (!primary && isLikelyPersonNameLine(line)) {
        primary = normalizeName(line).slice(0, 120);
        continue;
      }
      if (primary && isLikelyPersonNameLine(line)) {
        pushAlias(line);
      }
    }

    if (primary) {
      people.push({
        id: id(),
        report_id: PLACEHOLDER_REPORT,
        source_id: null,
        full_name: primary,
        dob,
        aliases: aliases.slice(0, 24),
        include_in_report: true,
      });
    } else if (chunk.length > 20) {
      const legacy = extractSubjectPersonLegacy(chunk);
      for (const p of legacy) {
        people.push(p);
      }
    }
  }

  return people;
}

/** Legacy single-subject heuristics when no "Subject X of Y" markers exist. */
function extractSubjectPersonLegacy(text: string): ExtractedPerson[] {
  const upper = text.toUpperCase();
  const people: ExtractedPerson[] = [];

  const nameMatch =
    text.match(/(?:^|\n)\s*(?:SUBJECT|NAME|PRIMARY)\s*[#:]?\s*([^\n]+)/i) ??
    text.match(/(?:^|\n)\s*FULL\s*NAME\s*[:]?\s*([^\n]+)/i);
  let fullName = nameMatch?.[1]?.trim() ?? "";
  if (fullName.length > 120) {
    fullName = fullName.slice(0, 120);
  }

  const dobMatch = text.match(
    /(?:DOB|DATE\s+OF\s+BIRTH|BIRTH\s*DATE)\s*[:]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i
  );
  const dob = dobMatch?.[1]?.trim() ?? null;

  const akaMatch = text.match(/(?:AKA|ALIASES?|Observed\s+Names?)\s*[:]?\s*([^\n]+)/i);
  const aliases: string[] = [];
  if (akaMatch?.[1]) {
    akaMatch[1]
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12)
      .forEach((a) => aliases.push(a));
  }

  if (!fullName && upper.includes("TLO")) {
    const line = text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 3 && isLikelyPersonNameLine(l));
    if (line) {
      fullName = line.slice(0, 120);
    }
  }

  if (fullName) {
    people.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      full_name: fullName,
      dob,
      aliases,
      include_in_report: true,
    });
  }

  return people;
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

/** Second line of a two-line street (Apt / Unit / Suite) before city/state line. */
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

/** Text until next major section header line. */
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

const ADDRESS_SECTION_HEADERS: RegExp[] = [
  /(?:^|\n)\s*(?:Residential\s+)?Address\s+History(?:\s*\([^)]*\))?/im,
  /(?:^|\n)\s*Residential\s+Address(?:es)?\s+History/im,
  /(?:^|\n)\s*Mailing\s+Address(?:es)?/im,
  /(?:^|\n)\s*Current\s+Address(?:es)?(?:\s+Information)?/im,
];

/** Address History (...) and DL / ID-adjacent blocks; excludes Current Other Phones metadata lines. */
function extractAddresses(text: string): ExtractedAddress[] {
  const all: ExtractedAddress[] = [];
  const seen = new Set<string>();

  const pushUnique = (rows: ExtractedAddress[]) => {
    for (const a of rows) {
      const k = `${a.street}|${a.city}|${a.state}|${a.zip}`;
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      all.push(a);
    }
  };

  for (const headerRe of ADDRESS_SECTION_HEADERS) {
    const ahChunk = sliceAfterHeader(text, headerRe);
    if (ahChunk) {
      const section = takeSectionChunk(ahChunk);
      const lines = section.split("\n").filter((l) => !isCurrentOtherPhonesAtAddressLine(l));
      pushUnique(extractAddressesFromLines(lines, "Address history"));
    }
  }

  const dlIdx = text.search(
    /(?:^|\n)\s*(?:DRIVER'?S?\s+LICENSE|D\s*\/\s*L|STATE\s+(?:ID|IDENTIFICATION)|\bID\s+(?:CARD|NUMBER)|IDENTIFICATION|LICENSE\s+(?:NUMBER|#)|\bDL\s*#)/im
  );
  if (dlIdx >= 0) {
    const window = text.slice(dlIdx, dlIdx + 5000);
    const lines = window.split("\n").filter((l) => !isCurrentOtherPhonesAtAddressLine(l));
    pushUnique(extractAddressesFromLines(lines, "License / ID"));
  }

  return all.slice(0, 60);
}

const RELATIVES_SECTION_HEADER =
  /(?:^|\n)\s*(?:Possible\s+Relatives|Known\s+Relatives|Possible\s+Associates|Relatives\s+and\s+Associates)\b/i;

function parseRelativeLinesIntoAssociates(
  sectionLines: string[],
  seen: Set<string>
): ExtractedAssociate[] {
  const out: ExtractedAssociate[] = [];
  for (const raw of sectionLines) {
    const line = raw.trim();
    if (!line || line.length > 200) {
      continue;
    }
    if (lineLooksLikeSectionHeader(line)) {
      break;
    }
    if (/^(?:NAME|RELATION|RELATIONSHIP|AGE|DOB)\b/i.test(line)) {
      continue;
    }
    const parenRel = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (parenRel) {
      const name = parenRel[1].trim();
      const relLabel = parenRel[2].trim();
      if (
        isLikelyPersonNameLine(name) &&
        relLabel.length > 0 &&
        relLabel.length < 120 &&
        !/^\d{1,3}$/.test(relLabel)
      ) {
        const key = name.toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            id: id(),
            report_id: PLACEHOLDER_REPORT,
            source_id: null,
            name: name.slice(0, 200),
            relationship_label: relLabel.slice(0, 120),
            include_in_report: true,
          });
        }
        if (out.length >= 40) {
          break;
        }
        continue;
      }
    }
    const rel = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (rel && isLikelyPersonNameLine(rel[1].trim())) {
      const name = rel[1].trim().slice(0, 200);
      const key = name.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          id: id(),
          report_id: PLACEHOLDER_REPORT,
          source_id: null,
          name,
          relationship_label: rel[2].trim().slice(0, 120),
          include_in_report: true,
        });
      }
      continue;
    }
    if (isLikelyPersonNameLine(line)) {
      const name = line.slice(0, 200);
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
  }
  return out;
}

/**
 * Prefer Possible Relatives inside each Subject … of … block (stays aligned with that subject).
 * Falls back to first document-level Possible Relatives section when no subject blocks.
 */
function extractPossibleRelatives(text: string): ExtractedAssociate[] {
  const lines = text.split("\n");
  const blocks = findSubjectBlockRanges(lines);
  const seen = new Set<string>();
  const merged: ExtractedAssociate[] = [];

  if (blocks.length > 0) {
    for (const { start, end } of blocks) {
      const chunk = lines.slice(start, end).join("\n");
      const relChunk = sliceAfterHeader(chunk, RELATIVES_SECTION_HEADER);
      if (!relChunk) {
        continue;
      }
      const section = takeSectionChunk(relChunk);
      merged.push(...parseRelativeLinesIntoAssociates(section.split("\n"), seen));
    }
    if (merged.length > 0) {
      return merged;
    }
  }

  const chunk = sliceAfterHeader(text, RELATIVES_SECTION_HEADER);
  if (!chunk) {
    return extractAssociatesLegacy(text);
  }
  const section = takeSectionChunk(chunk);
  return parseRelativeLinesIntoAssociates(section.split("\n"), seen);
}

function extractAssociatesLegacy(text: string): ExtractedAssociate[] {
  const assocHeader =
    /(?:^|\n)\s*(?:ASSOCIATES?|RELATIVES?|POSSIBLE\s+ASSOCIATES?)\b/i;
  const assocChunk = sliceAfterHeader(text, assocHeader);
  if (!assocChunk) {
    return [];
  }
  const section = takeSectionChunk(assocChunk);
  const seen = new Set<string>();
  return parseRelativeLinesIntoAssociates(section.split("\n").map((l) => l.trim()), seen);
}

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

/** Prefer Possible Phones sections; omit whole-document phone scan. */
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

const YMM_NOISE_RE =
  /\b(?:report|statement|invoice|fee|total|account|page|section|copyright|annual|balance|payment)\b/i;

const VEHICLE_CONTEXT_RE =
  /\b(?:plate|licen[sc]e|reg\.?|registration|title|vin|vehicle|auto|motor)\b/i;

/** YMM only when the line also hints at vehicle context (reduces false positives). */
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

/** Strong signals only: VIN/YMM inside a vehicle section (no whole-document VIN scan). */
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

function extractEmployment(section: string): ExtractedEmployment[] {
  const out: ExtractedEmployment[] = [];
  for (const line of section.split("\n")) {
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
 * Best-effort TLO-style parse from plain text (PDF extraction output).
 * Section-aware heuristics tuned for typical TLO comprehensive layouts.
 */
export function parseTlo(rawText: string): ExtractedData {
  const text = normalizeExtractedText(rawText);
  const people = extractSubjectBlocks(text);
  const associates = extractPossibleRelatives(text);
  const addresses = extractAddresses(text);
  const phones = extractPhones(text);
  const vehicles = extractVehicles(text);

  const empHeader =
    /(?:^|\n)\s*(?:Employment|Employers?|Work\s+History|Current\s+Employment)\b/i;
  const empChunk = sliceAfterHeader(text, empHeader);
  const employment = empChunk ? extractEmployment(takeSectionChunk(empChunk, 6000)) : [];

  return {
    people,
    addresses,
    phones,
    vehicles,
    associates,
    employment,
  };
}
