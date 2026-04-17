import { formatDate } from "@/lib/utils/reports";
import { SOURCE_DOCUMENT_TYPE_LABELS } from "@/lib/config/report-templates";
import type { ReportSource } from "@/types";
import { FileText, ExternalLink } from "lucide-react";

interface ReportSourcesListProps {
  sources: ReportSource[];
}

export function ReportSourcesList({ sources }: ReportSourcesListProps) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-[#8b90a0]">No source documents uploaded yet.</p>
    );
  }

  return (
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
              </p>
            </div>
          </div>
          {s.file_url ? (
            <a
              href={s.file_url}
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
  );
}
