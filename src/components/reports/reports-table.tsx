"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, getReportTypeLabel, getStatusLabel } from "@/lib/utils/reports";
import { ReportStatus, type ReportListItem } from "@/types";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface ReportsTableProps {
  reports: ReportListItem[];
}

export function ReportsTable({ reports }: ReportsTableProps) {
  const router = useRouter();

  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-12 text-center">
        <FileText className="mx-auto mb-3 text-[#2a2f42]" size={32} />
        <p className="text-sm text-[#8b90a0]">No reports yet.</p>
        <Link
          href="/dashboard/reports/new"
          className="mt-3 inline-flex items-center text-sm text-[#4f7ef5] hover:underline"
        >
          Create your first report
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#2a2f42] bg-[#161922] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2f42]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Subject
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Case
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Date
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e2130]">
          {reports.map((report) => {
            const workspaceHref = `/dashboard/reports/${report.id}`;
            const detailsHref = `${workspaceHref}?details=1`;
            return (
            <tr
              key={report.id}
              className="hover:bg-[#1e2130] transition-colors cursor-pointer"
              onClick={() => {
                router.push(workspaceHref);
              }}
            >
              <td className="px-4 py-3 text-[#e8eaf0] font-medium">
                <Link
                  href={workspaceHref}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#e8eaf0] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f7ef5]/80 rounded-sm"
                >
                  {report.subject_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#8b90a0]">{report.case_name}</td>
              <td className="px-4 py-3 text-[#8b90a0]">
                {getReportTypeLabel(report.report_type)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={report.status} />
              </td>
              <td className="px-4 py-3 text-[#8b90a0]">
                {formatDate(report.report_date)}
              </td>
              <td
                className="px-4 py-3 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={detailsHref}
                  className="text-[#4f7ef5] text-xs font-medium hover:underline"
                >
                  Details
                </Link>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === ReportStatus.FINAL &&
          "bg-emerald-500/10 text-emerald-400",
        status === ReportStatus.DRAFT &&
          "bg-yellow-500/10 text-yellow-400",
        status === ReportStatus.ARCHIVED &&
          "bg-[#2a2f42] text-[#8b90a0]"
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
