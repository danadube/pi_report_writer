import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { MOCK_REPORTS } from "@/lib/mock/reports";
import { ReportPrintView } from "@/components/reports/report-print-view";

interface PrintReportPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function PrintReportPage({ params }: PrintReportPageProps) {
  const { reportId } = await params;

  // TODO: Replace with real Supabase query
  const report = MOCK_REPORTS.find((r) => r.id === reportId);

  if (!report) {
    notFound();
  }

  return (
    <div>
      {/* Toolbar — hidden on print */}
      <div className="no-print flex items-center justify-between mb-6">
        <Link
          href={`/dashboard/reports/${reportId}`}
          className="flex items-center gap-1.5 text-sm text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to report
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-[#4f7ef5] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors"
        >
          <Printer size={14} />
          Print / Export PDF
        </button>
      </div>

      <ReportPrintView report={report} />
    </div>
  );
}
