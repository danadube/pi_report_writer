import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { serverFetch } from "@/lib/api/server-fetch";
import { ReportEditForm } from "@/components/reports/report-edit-form";
import type { Report } from "@/types";

interface EditReportPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function EditReportPage({ params }: EditReportPageProps) {
  const { reportId } = await params;

  const res = await serverFetch(`/api/reports/${reportId}`);

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    return (
      <div className="max-w-2xl space-y-4">
        <BackLink reportId={reportId} />
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
    <div className="max-w-2xl space-y-6">
      <BackLink reportId={reportId} />

      <div>
        <h1 className="text-xl font-semibold text-[#e8eaf0]">Edit Report</h1>
        <p className="text-sm text-[#8b90a0] mt-0.5">{report.case_name || "Untitled case"}</p>
      </div>

      <ReportEditForm initialReport={report} />
    </div>
  );
}

function BackLink({ reportId }: { reportId: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/dashboard/reports/${reportId}`}
        className="flex items-center gap-1.5 text-sm text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to report
      </Link>
    </div>
  );
}
