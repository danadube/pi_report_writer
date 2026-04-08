import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MOCK_REPORTS } from "@/lib/mock/reports";

interface EditReportPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function EditReportPage({ params }: EditReportPageProps) {
  const { reportId } = await params;

  // TODO: Replace with real Supabase query
  const report = MOCK_REPORTS.find((r) => r.id === reportId);

  if (!report) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/reports/${reportId}`}
          className="flex items-center gap-1.5 text-sm text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to report
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-[#e8eaf0]">Edit Report</h1>
        <p className="text-sm text-[#8b90a0] mt-0.5">{report.case_name}</p>
      </div>

      {/* TODO: Render the appropriate form based on report.report_type */}
      {/* BACKGROUND_INVESTIGATION → BackgroundInvestigationForm */}
      {/* SURVEILLANCE → SurveillanceReportForm */}
      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-8 text-center">
        <p className="text-sm text-[#8b90a0]">
          Report edit form coming in Milestone 2.
        </p>
      </div>
    </div>
  );
}
