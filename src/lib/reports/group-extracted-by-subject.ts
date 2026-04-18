import type { ExtractedData } from "@/types";

function collectExplicitSubjectIndices(data: ExtractedData): Set<number> {
  const s = new Set<number>();
  const add = (row: { subject_index: number | null }) => {
    if (row.subject_index != null && Number.isFinite(row.subject_index)) {
      s.add(row.subject_index);
    }
  };
  for (const p of data.people) add(p);
  for (const a of data.addresses) add(a);
  for (const p of data.phones) add(p);
  for (const e of data.emails) add(e);
  for (const v of data.vehicles) add(v);
  for (const a of data.associates) add(a);
  for (const e of data.employment) add(e);
  return s;
}

/** True when any extracted row carries a subject_index (show subject-scoped layout). */
export function shouldShowSubjectHeaders(data: ExtractedData): boolean {
  return collectExplicitSubjectIndices(data).size > 0;
}

function sliceForSubjectIndex(
  data: ExtractedData,
  subjectIdx: number,
  primaryIdx: number,
  multiSubject: boolean
): ExtractedData {
  const match = <T extends { subject_index: number | null }>(rows: T[]): T[] =>
    rows.filter((r) => {
      if (r.subject_index != null) {
        return r.subject_index === subjectIdx;
      }
      if (!multiSubject) {
        return true;
      }
      return subjectIdx === primaryIdx;
    });

  return {
    people: match(data.people),
    addresses: match(data.addresses),
    phones: match(data.phones),
    emails: match(data.emails),
    vehicles: match(data.vehicles),
    associates: match(data.associates),
    employment: match(data.employment),
  };
}

function sectionHasRows(d: ExtractedData): boolean {
  return (
    d.people.length +
      d.addresses.length +
      d.phones.length +
      d.emails.length +
      d.vehicles.length +
      d.associates.length +
      d.employment.length >
    0
  );
}

export interface ExtractedSubjectSection {
  /** TLO subject index from the source (e.g. 1, 2). */
  subject_key: number;
  /** 1-based order in this document (1 = primary cluster). */
  display_rank: number;
  /** Short label: PRIMARY, SUBJECT 2, SUBJECT 3 */
  badge_label: string;
  /** Section heading */
  title: string;
  data: ExtractedData;
}

/**
 * Groups flat extracted rows into subject sections when subject_index is present on any row.
 * Legacy rows (all null subject_index) render as a single primary section.
 */
export function groupExtractedDataBySubject(data: ExtractedData): ExtractedSubjectSection[] {
  const explicit = collectExplicitSubjectIndices(data);

  if (explicit.size === 0) {
    return [
      {
        subject_key: 1,
        display_rank: 1,
        badge_label: "PRIMARY",
        title: "Subject 1 / Primary",
        data,
      },
    ];
  }

  const sortedKeys = [...explicit].sort((a, b) => a - b);
  const primaryIdx = Math.min(...sortedKeys);
  const multiSubject = explicit.size >= 2;

  const sections: ExtractedSubjectSection[] = [];
  let rank = 0;

  for (const subjectKey of sortedKeys) {
    const slice = sliceForSubjectIndex(data, subjectKey, primaryIdx, multiSubject);
    if (!sectionHasRows(slice)) {
      continue;
    }
    rank += 1;
    const isPrimaryCluster = subjectKey === primaryIdx;
    const badge_label = rank === 1 ? "PRIMARY" : `SUBJECT ${rank}`;
    const title =
      isPrimaryCluster && subjectKey === 1
        ? "Subject 1 / Primary"
        : isPrimaryCluster
          ? `Subject ${subjectKey} / Primary`
          : `Subject ${subjectKey}`;

    sections.push({
      subject_key: subjectKey,
      display_rank: rank,
      badge_label,
      title,
      data: slice,
    });
  }

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      subject_key: 1,
      display_rank: 1,
      badge_label: "PRIMARY",
      title: "Subject 1 / Primary",
      data,
    },
  ];
}
