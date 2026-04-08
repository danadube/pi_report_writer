import { MOCK_REPORTS } from "@/lib/mock/reports";
import { formatDate, getReportTypeLabel, getStatusLabel } from "@/lib/utils/reports";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";

interface ReportDetailPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId } = await params;

  // TODO: Replace with real Supabase query
  const report = MOCK_REPORTS.find((r) => r.id === reportId);

  if (!report) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/reports"
          className="flex items-center gap-1.5 text-sm text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
        >
          <ArrowLeft size={14} />
          Reports
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf0]">
            {report.subject_name}
          </h1>
          <p className="text-sm text-[#8b90a0] mt-0.5">{report.case_name}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/reports/${report.id}/print`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2a2f42] px-3 py-2 text-sm text-[#8b90a0] hover:bg-[#1e2130] transition-colors"
          >
            <Printer size={14} />
            Print Preview
          </Link>
          <Link
            href={`/dashboard/reports/${report.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#4f7ef5] px-3 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors"
          >
            <Pencil size={14} />
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] divide-y divide-[#2a2f42]">
        <DetailRow label="Report Type" value={getReportTypeLabel(report.report_type)} />
        <DetailRow label="Status" value={getStatusLabel(report.status)} />
        <DetailRow label="Case Name" value={report.case_name} />
        <DetailRow label="Client Name" value="—" />
        <DetailRow label="Investigator" value={report.investigator_name} />
        <DetailRow label="Report Date" value={formatDate(report.report_date)} />
        <DetailRow label="Created" value={formatDate(report.created_at)} />
        <DetailRow label="Last Updated" value={formatDate(report.updated_at)} />
      </div>

      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-5">
        <p className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-3">
          Investigator Notes
        </p>
        <p className="text-sm text-[#8b90a0] italic">No notes added yet.</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-5 py-3 gap-4">
      <span className="w-36 flex-shrink-0 text-sm text-[#8b90a0]">{label}</span>
      <span className="text-sm text-[#e8eaf0]">{value}</span>
    </div>
  );
}
