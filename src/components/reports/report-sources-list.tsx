import { formatDate } from "@/lib/utils/reports";
import { SOURCE_DOCUMENT_TYPE_LABELS } from "@/lib/config/report-templates";
import { resolveReportSourceFileUrl } from "@/lib/storage/report-files";
import type { ReportSource } from "@/types";
import { FileText, ExternalLink } from "lucide-react";

interface ReportSourcesListProps {
  sources: ReportSource[];
  /** When true, show a jump link to the Extraction review section (report detail page). */
  linkToExtractionReview?: boolean;
}

export function ReportSourcesList({
  sources,
  linkToExtractionReview = false,
}: ReportSourcesListProps) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-[#8b90a0]">
        No source documents uploaded yet. After upload, structured extraction appears in{" "}
        <span className="text-[#8b90a0]">Extraction review</span> below.
      </p>
    );
  }

  return (
    <>
    <ul className="divide-y divide-[#1e2130] rounded-lg border border-[#2a2f42] bg-[#161922]">
      {sources.map((s) => (
        <li
          key={s.id}
          className="flex items-start justify-between gap-3 px-4 py-3"
        >
          <div className="flex min-w-0 gap-3">
            <FileText
              size={18}
              className="mt-0.5 flex-shrink-0 text-[#4f7ef5]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#e8eaf0] truncate">
                {s.file_name}
              </p>
              <p className="text-xs text-[#8b90a0] mt-0.5">
                {SOURCE_DOCUMENT_TYPE_LABELS[s.source_type]} · Uploaded{" "}
                {formatDate(s.created_at)}
                {s.extraction_status === "running" ? (
                  <span className="block text-[#4f7ef5] mt-1">Extraction running…</span>
                ) : null}
                {s.extraction_status === "failed" && s.extraction_error ? (
                  <span className="block text-amber-400/90 mt-1">{s.extraction_error}</span>
                ) : null}
                {s.extraction_status === "complete" ? (
                  <>
                    <span className="block text-emerald-400/90 mt-1">
                      Raw text extracted
                      {typeof s.extracted_text === "string" && s.extracted_text.length > 0
                        ? ` (${s.extracted_text.length.toLocaleString()} characters)`
                        : ""}
                    </span>
                    <span className="block text-[#8b90a0] mt-0.5 text-[11px] leading-snug">
                      Structured fields saved to this report where detected (people, addresses,
                      phones, vehicles, associates, employment).
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          {s.file_url ? (
            <a
              href={resolveReportSourceFileUrl(s.file_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-[#4f7ef5] hover:underline"
            >
              Open
              <ExternalLink size={12} />
            </a>
          ) : null}
        </li>
      ))}
    </ul>
    {linkToExtractionReview ? (
      <p className="text-xs text-[#8b90a0] mt-2">
        <a
          href="#extraction"
          className="text-[#4f7ef5] hover:underline"
        >
          View structured extraction
        </a>
      </p>
    ) : null}
    </>
  );
}
