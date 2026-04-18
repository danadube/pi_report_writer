import { SOURCE_DOCUMENT_TYPE_LABELS } from "@/lib/config/report-templates";
import { emptyExtractedData } from "@/lib/reports/fetch-extracted-for-report";
import type { ReportSource } from "@/types";
import { ExtractionReviewReadonly } from "@/components/extraction/extraction-review-readonly";
import { FileText } from "lucide-react";

interface ReportExtractionReviewProps {
  sources: ReportSource[];
  reportId: string;
}

function StatusBadge({ status }: { status: ReportSource["extraction_status"] }) {
  const styles: Record<ReportSource["extraction_status"], string> = {
    pending: "bg-[#2a2f42] text-[#8b90a0]",
    running: "bg-blue-500/15 text-[#7ab3ff]",
    complete: "bg-emerald-500/15 text-emerald-300/90",
    failed: "bg-amber-500/15 text-amber-300/90",
  };
  const labels: Record<ReportSource["extraction_status"], string> = {
    pending: "Pending",
    running: "Running",
    complete: "Complete",
    failed: "Failed",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

/**
 * Per–source document extraction output for the report detail view.
 */
export function ReportExtractionReview({ sources, reportId }: ReportExtractionReviewProps) {
  if (sources.length === 0) {
    return (
      <section id="extraction" className="scroll-mt-10">
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-3">
          Extraction review
        </h2>
        <p className="text-sm text-[#8b90a0]">
          Upload a source document to run extraction and review structured fields here.
        </p>
      </section>
    );
  }

  return (
    <section id="extraction" className="scroll-mt-10 space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
          Extraction review
        </h2>
        <p className="text-sm text-[#8b90a0] mt-1">
          When the parser recognizes this layout, structured fields appear below by category. If none
          were saved, you still have raw text from the PDF. Use the toggles under Phones to exclude
          noisy numbers when phones exist; other categories are view-only for now.
        </p>
      </div>

      <div className="space-y-4">
        {sources.map((s) => {
          const data = s.extracted_data ?? emptyExtractedData();

          return (
            <article
              key={s.id}
              className="rounded-lg border border-[#2a2f42] bg-[#161922] overflow-hidden"
            >
              <div className="flex items-start gap-3 px-4 py-3 border-b border-[#1e2130] bg-[#12141c]/50">
                <FileText size={18} className="mt-0.5 shrink-0 text-[#4f7ef5]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <h3 className="text-sm font-medium text-[#e8eaf0] truncate">{s.file_name}</h3>
                    <StatusBadge status={s.extraction_status} />
                  </div>
                  <p className="text-xs text-[#8b90a0] mt-0.5">
                    {SOURCE_DOCUMENT_TYPE_LABELS[s.source_type]}
                  </p>
                </div>
              </div>

              <div className="px-4 py-4 space-y-3">
                {s.extraction_status === "running" ? (
                  <p className="text-sm text-[#7ab3ff]">Extraction in progress…</p>
                ) : null}

                {s.extraction_status === "pending" ? (
                  <p className="text-sm text-[#8b90a0]">
                    Extraction has not started for this file yet.
                  </p>
                ) : null}

                {s.extraction_status === "failed" && s.extraction_error ? (
                  <p className="text-sm text-amber-300/90 whitespace-pre-wrap">{s.extraction_error}</p>
                ) : null}

                {s.extraction_status === "complete" || s.extraction_status === "failed" ? (
                  <ExtractionReviewReadonly data={data} reportId={reportId} />
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
