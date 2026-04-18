"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils/reports";
import { SOURCE_DOCUMENT_TYPE_LABELS } from "@/lib/config/report-templates";
import { resolveReportSourceFileUrl } from "@/lib/storage/report-files";
import { countStructuredFields, emptyExtractedData } from "@/lib/reports/fetch-extracted-for-report";
import type { ReportSource } from "@/types";
import { ExternalLink, FileText, RefreshCw, Trash2 } from "lucide-react";

interface ReportSourcesListProps {
  sources: ReportSource[];
  /** When true, show a jump link to the Extraction review section (report detail page). */
  linkToExtractionReview?: boolean;
  /** When set, each source shows a delete control (report owner only; enforced server-side). */
  reportId?: string;
}

export function ReportSourcesList({
  sources,
  linkToExtractionReview = false,
  reportId,
}: ReportSourcesListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [rerunErrorBySourceId, setRerunErrorBySourceId] = useState<Record<string, string>>(
    {}
  );
  const [rerunSuccessSourceId, setRerunSuccessSourceId] = useState<string | null>(null);

  async function handleRerunExtraction(source: ReportSource) {
    setRerunErrorBySourceId((prev) => {
      const next = { ...prev };
      delete next[source.id];
      return next;
    });
    setRerunningId(source.id);
    try {
      const res = await fetch("/api/extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, force: true }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setRerunErrorBySourceId((prev) => ({
          ...prev,
          [source.id]:
            typeof json?.error === "string" ? json.error : "Re-run extraction failed",
        }));
        return;
      }
      setRerunSuccessSourceId(source.id);
      window.setTimeout(() => setRerunSuccessSourceId(null), 3200);
      router.refresh();
    } catch {
      setRerunErrorBySourceId((prev) => ({
        ...prev,
        [source.id]: "Network error while re-running extraction.",
      }));
    } finally {
      setRerunningId(null);
    }
  }

  async function handleDelete(source: ReportSource) {
    if (!reportId) {
      return;
    }
    if (
      !confirm(
        `Delete “${source.file_name}”? This removes the file from storage, all extracted fields for this document, and cannot be undone.`
      )
    ) {
      return;
    }
    setError(null);
    setDeletingId(source.id);
    try {
      const res = await fetch(
        `/api/reports/${encodeURIComponent(reportId)}/sources/${encodeURIComponent(source.id)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        storageWarning?: string;
        ok?: boolean;
      } | null;
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Delete failed");
        return;
      }
      if (json?.storageWarning) {
        console.warn("[source delete] storage:", json.storageWarning);
      }
      router.refresh();
    } catch {
      setError("Network error while deleting.");
    } finally {
      setDeletingId(null);
    }
  }

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
      {error ? (
        <p className="text-sm text-red-300/90 mb-2" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-[#1e2130] rounded-lg border border-[#2a2f42] bg-[#161922]">
        {sources.map((s) => {
          const structuredCount = countStructuredFields(s.extracted_data ?? emptyExtractedData());
          return (
          <li
            key={s.id}
            className="px-4 py-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <FileText
                size={18}
                className="mt-0.5 shrink-0 text-[#4f7ef5]"
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
                      {structuredCount > 0 ? (
                        <span className="block text-[#8b90a0] mt-0.5 text-[11px] leading-snug">
                          Structured fields saved to this report ({structuredCount.toLocaleString()}{" "}
                          row{structuredCount === 1 ? "" : "s"} across people, addresses, phones,
                          vehicles, associates, employment).
                        </span>
                      ) : (
                        <span className="block text-amber-400/85 mt-0.5 text-[11px] leading-snug">
                          No structured fields were detected or saved for this document. Raw text is
                          still available; check Extraction review below or open the PDF.
                        </span>
                      )}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {s.file_url ? (
                <a
                  href={resolveReportSourceFileUrl(s.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#4f7ef5] hover:underline"
                >
                  Open
                  <ExternalLink size={12} />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => handleRerunExtraction(s)}
                disabled={
                  s.extraction_status === "running" ||
                  rerunningId === s.id
                }
                title="Re-run extraction with latest parser"
                className="inline-flex items-center gap-1 rounded border border-[#4f7ef5]/35 px-2 py-1 text-xs text-[#7ab3ff] hover:bg-[#4f7ef5]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  aria-hidden
                  className={
                    rerunningId === s.id || s.extraction_status === "running"
                      ? "animate-spin"
                      : undefined
                  }
                />
                {s.extraction_status === "running"
                  ? "Running…"
                  : rerunningId === s.id
                    ? "Re-running…"
                    : "Re-run"}
              </button>
              {reportId ? (
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  disabled={deletingId === s.id}
                  className="inline-flex items-center gap-1 rounded border border-red-500/35 px-2 py-1 text-xs text-red-300/90 hover:bg-red-500/10 disabled:opacity-50"
                  aria-label={`Delete source ${s.file_name}`}
                >
                  <Trash2 size={12} aria-hidden />
                  Delete
                </button>
              ) : null}
            </div>
            </div>
            {rerunErrorBySourceId[s.id] ? (
              <p className="text-xs text-red-300/90 pl-[34px]" role="alert">
                {rerunErrorBySourceId[s.id]}
              </p>
            ) : null}
            {rerunSuccessSourceId === s.id ? (
              <p className="text-xs text-emerald-400/90 pl-[34px]">
                Extraction finished — refreshing.
              </p>
            ) : null}
          </li>
          );
        })}
      </ul>
      {linkToExtractionReview ? (
        <p className="text-xs text-[#8b90a0] mt-2">
          <a href="#extraction" className="text-[#4f7ef5] hover:underline">
            View structured extraction
          </a>
        </p>
      ) : null}
    </>
  );
}
