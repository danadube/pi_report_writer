import { serverFetch } from "@/lib/api/server-fetch";
import { formatDate, getReportTypeLabel, getStatusLabel } from "@/lib/utils/reports";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReportDraftWorkflow } from "@/components/reports/report-draft-workflow";
import { ReportExtractionReview } from "@/components/reports/report-extraction-review";
import { SummarySelectionReview } from "@/components/reports/summary-selection-review";
import { ReportWorkspaceShell } from "@/components/reports/report-workspace-shell";
import type { Report } from "@/types";

interface ReportDetailPageProps {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ details?: string; panel?: string }>;
}

export default async function ReportDetailPage({ params, searchParams }: ReportDetailPageProps) {
  const { reportId } = await params;
  const sp = await searchParams;
  const defaultDetailsOpen =
    sp.details === "1" || sp.panel === "details" || sp.details === "true";

  const res = await serverFetch(`/api/reports/${reportId}`);

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    return (
      <div className="max-w-3xl space-y-4">
        <div
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          Could not load this report ({res.status}).
        </div>
      </div>
    );
  }

  const report = (await res.json()) as Report;
  const sources = report.sources ?? [];

  let hasDurableDraft = false;
  const versionsRes = await serverFetch(`/api/reports/${reportId}/draft-versions`);
  if (versionsRes.ok) {
    const vJson = (await versionsRes.json()) as { versions?: unknown[] };
    hasDurableDraft = (vJson.versions?.length ?? 0) > 0;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/reports"
          className="flex items-center gap-1.5 text-sm text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
        >
          <ArrowLeft size={14} />
          Reports
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-[#e8eaf0]">
          {report.subject_name || "—"}
        </h1>
        <p className="text-sm text-[#8b90a0] mt-0.5">{report.case_name || "—"}</p>
        <p className="text-xs text-[#8b90a0] mt-2">
          {getReportTypeLabel(report.report_type)} · {getStatusLabel(report.status)} ·{" "}
          {formatDate(report.report_date)}
        </p>
      </div>

      <ReportWorkspaceShell
        report={report}
        sources={sources}
        defaultDetailsOpen={defaultDetailsOpen}
      >
        <ReportExtractionReview sources={sources} reportId={report.id} />

        <ReportDraftWorkflow reportId={report.id} />

        {!hasDurableDraft ? <SummarySelectionReview reportId={report.id} /> : null}
      </ReportWorkspaceShell>
    </div>
  );
}
