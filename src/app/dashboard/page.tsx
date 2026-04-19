import Link from "next/link";
import { Plus } from "lucide-react";
import { LastWorkedReportCard } from "@/components/reports/last-worked-report-card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf0]">Dashboard</h1>
          <p className="text-sm text-[#8b90a0] mt-0.5">
            Welcome back. Your reports are ready.
          </p>
        </div>
        <Link
          href="/dashboard/reports/new"
          className="inline-flex items-center gap-2 rounded-md bg-[#4f7ef5] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors"
        >
          <Plus size={15} />
          New Report
        </Link>
      </div>

      <LastWorkedReportCard />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Reports" value="—" />
        <StatCard label="Drafts" value="—" />
        <StatCard label="Final" value="—" />
      </div>

      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-8 text-center">
        <p className="text-sm text-[#8b90a0]">
          Go to{" "}
          <Link
            href="/dashboard/reports"
            className="text-[#4f7ef5] hover:underline"
          >
            Reports
          </Link>{" "}
          to view or create reports.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#2a2f42] bg-[#161922] px-5 py-4">
      <p className="text-xs text-[#8b90a0] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-[#e8eaf0] mt-1">{value}</p>
    </div>
  );
}
