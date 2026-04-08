import Link from "next/link";
import { Plus } from "lucide-react";
import { MOCK_REPORTS } from "@/lib/mock/reports";
import { ReportsTable } from "@/components/reports/reports-table";

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf0]">Reports</h1>
          <p className="text-sm text-[#8b90a0] mt-0.5">
            {MOCK_REPORTS.length} report{MOCK_REPORTS.length !== 1 ? "s" : ""}
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

      <ReportsTable reports={MOCK_REPORTS} />
    </div>
  );
}
