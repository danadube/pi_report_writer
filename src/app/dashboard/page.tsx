import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportStatus } from "@/types";
import { LastWorkedReportCard } from "@/components/reports/last-worked-report-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: statusRows, error } = await supabase
    .from("reports")
    .select("status")
    .eq("created_by_user_id", user.id);

  const rows = statusRows ?? [];
  const total = rows.length;
  const drafts = rows.filter((r) => r.status === ReportStatus.DRAFT).length;
  const finals = rows.filter((r) => r.status === ReportStatus.FINAL).length;

  if (error) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <div
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          Could not load report summary.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeader />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
          Resume work
        </h2>
        <LastWorkedReportCard />
        {total === 0 ? (
          <p className="text-sm text-[#8b90a0]">
            When you open a report, your last active report appears here so you
            can jump back into the workspace quickly.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
          Your reports
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total" value={String(total)} />
          <StatCard label="Drafts" value={String(drafts)} />
          <StatCard label="Final" value={String(finals)} />
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-[#2a2f42] bg-[#161922] px-5 py-4">
        <div>
          <p className="text-sm font-medium text-[#e8eaf0]">Browse all reports</p>
          <p className="text-sm text-[#8b90a0] mt-0.5">
            Open a report to work in the workspace—draft, sources, and review live
            there.
          </p>
        </div>
        <Link
          href="/dashboard/reports"
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-[#2a2f42] px-4 py-2 text-sm font-medium text-[#e8eaf0] hover:bg-[#1e2130] transition-colors"
        >
          Go to Reports
        </Link>
      </div>
    </div>
  );
}

function DashboardHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[#e8eaf0]">Dashboard</h1>
        <p className="text-sm text-[#8b90a0] mt-0.5 max-w-xl">
          Pick up your last report or open any report to continue in the
          workspace—where drafting and review happen.
        </p>
      </div>
      <Link
        href="/dashboard/reports/new"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#4f7ef5] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors sm:shrink-0"
      >
        <Plus size={15} />
        New Report
      </Link>
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
