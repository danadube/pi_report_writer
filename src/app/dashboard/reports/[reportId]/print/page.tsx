import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { serverFetch } from "@/lib/api/server-fetch";
import { ReportPrintView } from "@/components/reports/report-print-view";
import { PrintToolbar } from "@/components/reports/print-toolbar";
import type { Report } from "@/types";

interface PrintReportPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function PrintReportPage({ params }: PrintReportPageProps) {
  const { reportId } = await params;

  const res = await serverFetch(`/api/reports/${reportId}`);

  if (res.status === 404) {
    console.error("[report-page-debug] serverFetch 404 → notFound()", { reportId });
    notFound();
  }

  if (!res.ok) {
    console.error("[report-page-debug] serverFetch non-OK (not 404)", {
      reportId,
      status: res.status,
    });
    return (
      <div className="space-y-4">
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

  return (
    <div>
      <div className="no-print flex items-center justify-between mb-6">
        <Link
          href={`/dashboard/reports/${reportId}`}
          className="flex items-center gap-1.5 text-sm text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to report
        </Link>
        <PrintToolbar />
      </div>

      <ReportPrintView report={report} />
    </div>
  );
}
