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

/** US phone patterns (loose, deduped by last 10 digits). */
const PHONE_RE =
  /(?:\+1[-.\s]?)?(?:\(?\d{3}\)[-.\s]?|\d{3}[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

/** 17-char VIN (no I/O/Q). */
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

/** City, ST  ZIP line (common in TLO-style dumps). */
const CITY_ST_ZIP_RE =
  /^([A-Za-z][A-Za-z\s'.-]+),\s*([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?\s*$/;

function normalizePhoneDigits(s: string): string {
  return s.replace(/\D/g, "").slice(-10);
}

function extractPhonesGlobal(text: string): ExtractedPhone[] {
  const seen = new Set<string>();
  const out: ExtractedPhone[] = [];
  const matches = text.match(PHONE_RE) ?? [];
  for (const raw of matches) {
    const key = normalizePhoneDigits(raw);
    if (key.length !== 10 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      phone_number: raw.trim(),
      phone_type: null,
      include_in_report: true,
    });
  }
  return out;
}

function sliceAfterHeader(text: string, headerRe: RegExp): string | null {
  const m = text.match(headerRe);
  if (!m || m.index === undefined) {
    return null;
  }
  return text.slice(m.index + m[0].length);
}

/** Take text until the next all-caps style section header line. */
function takeSection(chunk: string, maxLen = 12000): string {
  const lines = chunk.split("\n");
  const buf: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (
      t.length > 3 &&
      t.length < 80 &&
      /^[A-Z][A-Z0-9\s/&,-]{2,}$/.test(t) &&
      !t.includes(".") &&
      buf.length > 2
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

function extractSubjectPerson(text: string): ExtractedPerson[] {
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

  const akaMatch = text.match(/(?:AKA|ALIASES?)\s*[:]?\s*([^\n]+)/i);
  const aliases: string[] = [];
  if (akaMatch?.[1]) {
    akaMatch[1]
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8)
      .forEach((a) => aliases.push(a));
  }

  if (!fullName && upper.includes("TLO")) {
    // Fallback: first non-empty line that looks like a person line
    const line = text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 3 && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(l));
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

function extractAddresses(text: string): ExtractedAddress[] {
  const lines = text.split("\n");
  const out: ExtractedAddress[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length - 1; i++) {
    const street = lines[i].trim();
    const cityLine = lines[i + 1]?.trim() ?? "";
    const cityMatch = cityLine.match(CITY_ST_ZIP_RE);
    if (!cityMatch) {
      continue;
    }
    if (!/^\d+\s+/.test(street) && !/^(?:P\.?O\.?\s*BOX|PO\s*BOX)\s+/i.test(street)) {
      continue;
    }
    const city = cityMatch[1].trim();
    const state = cityMatch[2];
    const zip = cityMatch[3] + (cityMatch[4] ? `-${cityMatch[4]}` : "");
    const key = `${street}|${city}|${state}|${zip}`;
    if (seen.has(key) || out.length >= 40) {
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
    i++;
  }

  return out;
}

function extractAssociates(section: string): ExtractedAssociate[] {
  const out: ExtractedAssociate[] = [];
  const lines = section.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (line.length < 3 || line.length > 200) {
      continue;
    }
    if (/^(?:NAME|RELATION|PAGE|\d+\s*\/\s*\d+)/i.test(line)) {
      continue;
    }
    const rel = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (rel) {
      out.push({
        id: id(),
        report_id: PLACEHOLDER_REPORT,
        source_id: null,
        name: rel[1].trim().slice(0, 200),
        relationship_label: rel[2].trim().slice(0, 120),
        include_in_report: true,
      });
    } else if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(line)) {
      out.push({
        id: id(),
        report_id: PLACEHOLDER_REPORT,
        source_id: null,
        name: line.slice(0, 200),
        relationship_label: null,
        include_in_report: true,
      });
    }
    if (out.length >= 30) {
      break;
    }
  }
  return out;
}

function extractEmployment(section: string): ExtractedEmployment[] {
  const out: ExtractedEmployment[] = [];
  for (const line of section.split("\n")) {
    const t = line.trim();
    if (t.length < 3 || t.length > 200) {
      continue;
    }
    if (/employer|company|position|title/i.test(t) && /[:–-]/.test(t)) {
      const parts = t.split(/[:–-]/);
      const employer = parts[0]?.replace(/^[^A-Za-z0-9]+/, "").trim() ?? "";
      const role = parts.slice(1).join(":").trim() || null;
      if (employer.length > 2) {
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

function extractVehicles(text: string): ExtractedVehicle[] {
  const out: ExtractedVehicle[] = [];
  const seenVin = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VIN_RE);
  while ((m = re.exec(text)) !== null) {
    const vin = m[1].toUpperCase();
    if (seenVin.has(vin)) {
      continue;
    }
    seenVin.add(vin);
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
    if (out.length >= 15) {
      break;
    }
  }

  const ymm =
    /\b((?:19|20)\d{2})\s+([A-Za-z][A-Za-z-]+)\s+([A-Za-z0-9][A-Za-z0-9\s-]{1,40})/g;
  let ym: RegExpExecArray | null;
  while ((ym = ymm.exec(text)) !== null) {
    out.push({
      id: id(),
      report_id: PLACEHOLDER_REPORT,
      source_id: null,
      year: ym[1],
      make: ym[2]?.trim() ?? null,
      model: ym[3]?.trim().split(/\s+/).slice(0, 6).join(" ") ?? null,
      vin: null,
      plate: null,
      state: null,
      include_in_report: true,
    });
    if (out.length >= 25) {
      break;
    }
  }

  return out.slice(0, 25);
}

/**
 * Best-effort TLO-style parse from plain text (PDF extraction output).
 * Heuristic only — tune against real TLO samples over time.
 */
export function parseTlo(rawText: string): ExtractedData {
  const text = rawText.replace(/\r\n/g, "\n");
  const phones = extractPhonesGlobal(text);
  const addresses = extractAddresses(text);

  const people = extractSubjectPerson(text);

  const assocHeader =
    /(?:^|\n)\s*(?:ASSOCIATES?|RELATIVES?|POSSIBLE\s+ASSOCIATES?)\b/i;
  const assocChunk = sliceAfterHeader(text, assocHeader);
  const associates = assocChunk
    ? extractAssociates(takeSection(assocChunk))
    : [];

  const empHeader = /(?:^|\n)\s*(?:EMPLOYMENT|EMPLOYERS?|WORK\s+HISTORY)\b/i;
  const empChunk = sliceAfterHeader(text, empHeader);
  const employment = empChunk ? extractEmployment(takeSection(empChunk)) : [];

  let vehicles = extractVehicles(text);
  const vehHeader = /(?:^|\n)\s*(?:VEHICLES?|VEHICLE\s+SUMMARY|AUTO)\b/i;
  const vehChunk = sliceAfterHeader(text, vehHeader);
  if (vehChunk && vehicles.length === 0) {
    vehicles = extractVehicles(takeSection(vehChunk));
  }

  return {
    people,
    addresses,
    phones,
    vehicles,
    associates,
    employment,
  };
}
