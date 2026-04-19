"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronDown, ListChecks, Printer, RefreshCw } from "lucide-react";
import { formatDate, getReportTypeLabel, getStatusLabel } from "@/lib/utils/reports";
import { DRAFT_REVIEW_PANEL_ID } from "@/components/reports/draft-review-panel-id";
import { ReportSourcesList } from "@/components/reports/report-sources-list";
import type { Report, ReportSource } from "@/types";
import { cn } from "@/lib/utils";

interface ReportWorkspaceShellProps {
  report: Report;
  sources: ReportSource[];
  defaultDetailsOpen: boolean;
  children: React.ReactNode;
}

export function ReportWorkspaceShell({
  report,
  sources,
  defaultDetailsOpen,
  children,
}: ReportWorkspaceShellProps) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const scrollToReviewQueue = useCallback(() => {
    globalThis.document.getElementById(DRAFT_REVIEW_PANEL_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const scrollToSources = useCallback(() => {
    globalThis.document.getElementById("report-sources-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleRerunExtraction = useCallback(async () => {
    setRerunError(null);
    if (sources.length === 0) {
      return;
    }
    if (sources.length > 1) {
      setDetailsOpen(true);
      window.setTimeout(() => {
        scrollToSources();
      }, 50);
      return;
    }

    const sourceId = sources[0].id;
    setRerunning(true);
    try {
      const res = await fetch("/api/extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, force: true }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRerunError(typeof json.error === "string" ? json.error : "Re-run extraction failed");
        return;
      }
      router.refresh();
    } catch {
      setRerunError("Network error while re-running extraction.");
    } finally {
      setRerunning(false);
    }
  }, [router, scrollToSources, sources]);

  const printHref = `/dashboard/reports/${report.id}/print`;
  const editHref = `/dashboard/reports/${report.id}/edit`;
  const singleSourceBusy = sources.length === 1 && sources[0].extraction_status === "running";

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-[#2a2f42] bg-[#12141c]/80 px-3 py-2.5"
        aria-label="Workspace quick actions"
      >
        <button
          type="button"
          onClick={() => scrollToReviewQueue()}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2f42] px-3 py-1.5 text-xs font-medium text-[#e8eaf0] hover:bg-[#1e2130] transition-colors"
        >
          <ListChecks size={14} aria-hidden />
          Open review queue
        </button>
        <button
          type="button"
          disabled={sources.length === 0 || rerunning || singleSourceBusy}
          onClick={() => void handleRerunExtraction()}
          title={
            sources.length === 0
              ? "Upload a source document first"
              : sources.length > 1
                ? "Jump to sources to re-run a specific document"
                : "Re-run extraction on the uploaded source"
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2f42] px-3 py-1.5 text-xs font-medium text-[#e8eaf0] hover:bg-[#1e2130] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} aria-hidden className={rerunning ? "animate-spin" : undefined} />
          Re-run extraction
        </button>
        <Link
          href={printHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#4f7ef5]/35 bg-[#4f7ef5]/10 px-3 py-1.5 text-xs font-medium text-[#7ab3ff] hover:bg-[#4f7ef5]/15 transition-colors"
        >
          <Printer size={14} aria-hidden />
          Print preview
        </Link>
        {rerunError ? (
          <span className="text-xs text-red-300/90 ml-auto" role="alert">
            {rerunError}
          </span>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#1a1d28] transition-colors"
          aria-expanded={detailsOpen}
        >
          <div>
            <p className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Report details
            </p>
            <p className="text-sm text-[#8b90a0] mt-0.5">
              Metadata, investigator notes, and source documents
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={editHref}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-[#4f7ef5] hover:underline"
            >
              Edit fields
            </Link>
            <ChevronDown
              size={18}
              className={cn("text-[#8b90a0] transition-transform", detailsOpen && "rotate-180")}
              aria-hidden
            />
          </div>
        </button>

        {detailsOpen ? (
          <div className="border-t border-[#2a2f42] px-4 py-4 space-y-5">
            <div className="rounded-lg border border-[#2a2f42] bg-[#12141c]/40 divide-y divide-[#2a2f42]">
              <DetailRow label="Report Type" value={getReportTypeLabel(report.report_type)} />
              <DetailRow label="Status" value={getStatusLabel(report.status)} />
              <DetailRow label="Case Name" value={report.case_name || "—"} />
              <DetailRow label="Client Name" value={report.client_name || "—"} />
              <DetailRow label="Investigator" value={report.investigator_name || "—"} />
              <DetailRow label="Report Date" value={formatDate(report.report_date)} />
              <DetailRow label="Created" value={formatDate(report.created_at)} />
              <DetailRow label="Last Updated" value={formatDate(report.updated_at)} />
            </div>

            <div>
              <p className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
                Investigator notes
              </p>
              <div className="rounded-lg border border-[#2a2f42] bg-[#12141c]/40 px-4 py-3">
                {report.summary_notes ? (
                  <p className="text-sm text-[#e8eaf0] whitespace-pre-wrap">{report.summary_notes}</p>
                ) : (
                  <p className="text-sm text-[#8b90a0] italic">No notes added yet.</p>
                )}
              </div>
            </div>

            <div id="report-sources-panel" className="scroll-mt-10 space-y-2">
              <p className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
                Source documents
              </p>
              <ReportSourcesList
                sources={sources}
                reportId={report.id}
                linkToExtractionReview
              />
            </div>
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-4 py-2.5 gap-4">
      <span className="w-32 flex-shrink-0 text-xs text-[#8b90a0] sm:w-36">{label}</span>
      <span className="text-sm text-[#e8eaf0]">{value}</span>
    </div>
  );
}
