import type { ReactNode } from "react";
import type { ExtractedData } from "@/types";
import { ExtractionPhoneRows } from "@/components/extraction/extraction-phone-rows";
import {
  groupExtractedDataBySubject,
  shouldShowSubjectHeaders,
} from "@/lib/reports/group-extracted-by-subject";

function InclusionHint({ included }: { included: boolean }) {
  if (included) {
    return null;
  }
  return (
    <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-400/80 shrink-0">
      Excluded from report
    </span>
  );
}

function CategoryBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#1e2130] bg-[#12141c]/80 overflow-hidden">
      <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#8b90a0] border-b border-[#1e2130]">
        {title}
      </p>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-sm text-[#6b7080] italic">{text}</p>;
}

function countStructured(d: ExtractedData): number {
  return (
    d.people.length +
    d.addresses.length +
    d.phones.length +
    d.emails.length +
    d.vehicles.length +
    d.associates.length +
    d.employment.length
  );
}

function SubjectCategoryGrid({
  data,
  reportId,
  hidePersonSubjectChips,
}: {
  data: ExtractedData;
  reportId?: string;
  hidePersonSubjectChips: boolean;
}) {
  return (
    <div className="space-y-3">
      <CategoryBlock title="Identity / People">
        {data.people.length === 0 ? (
          <EmptyLine text="None extracted." />
        ) : (
          <ul className="space-y-2">
            {data.people.map((p) => (
              <li key={p.id} className="text-sm">
                <span
                  className={
                    p.include_in_report ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"
                  }
                >
                  {p.full_name}
                </span>
                {!hidePersonSubjectChips && p.subject_index != null ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-[#6b7080] shrink-0">
                    {p.is_primary_subject ? "Primary" : `Subject ${p.subject_index}`}
                  </span>
                ) : null}
                <InclusionHint included={p.include_in_report} />
                <div className="text-xs text-[#8b90a0] mt-0.5 space-y-0.5">
                  {p.dob ? <p>DOB: {p.dob}</p> : null}
                  {p.ssn ? <p>SSN: {p.ssn}</p> : null}
                  {p.drivers_license_number ? (
                    <p>Driver license #: {p.drivers_license_number}</p>
                  ) : null}
                  {p.drivers_license_state ? (
                    <p>Driver license state: {p.drivers_license_state}</p>
                  ) : null}
                  {p.aliases.length > 0 ? <p>Also known as: {p.aliases.join(", ")}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CategoryBlock>

      <CategoryBlock title="Addresses">
        {data.addresses.length === 0 ? (
          <EmptyLine text="None extracted." />
        ) : (
          <ul className="space-y-2">
            {data.addresses.map((a) => (
              <li key={a.id} className="text-sm">
                {a.label ? (
                  <p className="text-xs text-[#8b90a0] mb-0.5">{a.label}</p>
                ) : null}
                <span
                  className={
                    a.include_in_report ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"
                  }
                >
                  {a.street}, {a.city}, {a.state} {a.zip}
                </span>
                <InclusionHint included={a.include_in_report} />
                {a.date_from && a.date_to ? (
                  <p className="text-xs text-[#8b90a0] mt-0.5">
                    {a.date_from} – {a.date_to}
                  </p>
                ) : a.date_range_text ? (
                  <p className="text-xs text-[#8b90a0] mt-0.5">{a.date_range_text}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CategoryBlock>

      <CategoryBlock title="Phones">
        {data.phones.length === 0 ? (
          <EmptyLine text="None extracted." />
        ) : reportId ? (
          <ExtractionPhoneRows reportId={reportId} initialPhones={data.phones} />
        ) : (
          <ul className="space-y-1.5">
            {data.phones.map((p) => (
              <li key={p.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                <span
                  className={
                    p.include_in_report ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"
                  }
                >
                  {p.phone_number}
                </span>
                <InclusionHint included={p.include_in_report} />
                {p.phone_type || p.confidence != null ? (
                  <span className="text-xs text-[#8b90a0]">
                    {p.phone_type ? `(${p.phone_type})` : ""}
                    {p.confidence != null ? `${p.phone_type ? " " : ""}${p.confidence}%` : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CategoryBlock>

      <CategoryBlock title="Emails">
        {data.emails.length === 0 ? (
          <EmptyLine text="None extracted." />
        ) : (
          <ul className="space-y-1.5">
            {data.emails.map((e) => (
              <li key={e.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                <span
                  className={
                    e.include_in_report ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"
                  }
                >
                  {e.email}
                </span>
                <InclusionHint included={e.include_in_report} />
                {e.confidence != null ? (
                  <span className="text-xs text-[#8b90a0]">{e.confidence}%</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CategoryBlock>

      <CategoryBlock title="Associates / relatives">
        {data.associates.length === 0 ? (
          <EmptyLine text="None extracted." />
        ) : (
          <ul className="space-y-1.5">
            {data.associates.map((a) => (
              <li key={a.id} className="text-sm">
                <span
                  className={
                    a.include_in_report ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"
                  }
                >
                  {a.name}
                </span>
                <InclusionHint included={a.include_in_report} />
                {a.relationship_label ? (
                  <span className="text-xs text-[#8b90a0] ml-1">— {a.relationship_label}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CategoryBlock>

      <CategoryBlock title="Employment">
        {data.employment.length === 0 ? (
          <EmptyLine text="None extracted." />
        ) : (
          <ul className="space-y-2">
            {data.employment.map((e) => (
              <li key={e.id} className="text-sm">
                <span
                  className={
                    e.include_in_report ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"
                  }
                >
                  {e.employer_name}
                </span>
                <InclusionHint included={e.include_in_report} />
                {e.role_title ? (
                  <p className="text-xs text-[#8b90a0] mt-0.5">{e.role_title}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CategoryBlock>

      <CategoryBlock title="Vehicles">
        {data.vehicles.length === 0 ? (
          <EmptyLine text="None extracted." />
        ) : (
          <ul className="space-y-2">
            {data.vehicles.map((v) => (
              <li key={v.id} className="text-sm text-[#e8eaf0]">
                <span className={v.include_in_report ? "" : "text-[#8b90a0] line-through"}>
                  {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                </span>
                <InclusionHint included={v.include_in_report} />
                <div className="text-xs text-[#8b90a0] mt-0.5">
                  {[v.plate && `Plate ${v.plate}`, v.state, v.vin && `VIN ${v.vin}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CategoryBlock>
    </div>
  );
}

export interface ExtractionReviewReadonlyProps {
  data: ExtractedData;
  /** When set, phone rows are interactive (include/exclude persisted via API). */
  reportId?: string;
}

/**
 * Extraction snapshot: grouped by subject when subject_index is present on rows; otherwise one block.
 */
export function ExtractionReviewReadonly({ data, reportId }: ExtractionReviewReadonlyProps) {
  if (countStructured(data) === 0) {
    return (
      <p className="text-sm text-[#8b90a0]">
        No structured fields were detected or saved for this document. Raw text extraction may
        still have succeeded—use Open on the source row to review the PDF, or rely on the character
        count shown there.
      </p>
    );
  }

  const showSubjectHeaders = shouldShowSubjectHeaders(data);
  const sections = groupExtractedDataBySubject(data);

  if (!showSubjectHeaders) {
    return (
      <SubjectCategoryGrid
        data={data}
        reportId={reportId}
        hidePersonSubjectChips={false}
      />
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((sec) => (
        <div key={sec.subject_key} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#1e2130] pb-2">
            <h4 className="text-sm font-semibold text-[#e8eaf0]">{sec.title}</h4>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#6b7080]">
              {sec.badge_label}
            </span>
          </div>
          <SubjectCategoryGrid
            data={sec.data}
            reportId={reportId}
            hidePersonSubjectChips
          />
        </div>
      ))}
    </div>
  );
}
