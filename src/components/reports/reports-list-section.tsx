"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ReportsTable } from "@/components/reports/reports-table";
import type { ReportListItem } from "@/types";

export function ReportsListSection() {
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reports");
        const data = (await res.json().catch(() => ({}))) as
          | ReportListItem[]
          | { error?: string };

        if (cancelled) return;

        if (!res.ok) {
          setError(
            "error" in data && typeof data.error === "string"
              ? data.error
              : `Failed to load reports (${res.status})`
          );
          setReports([]);
          return;
        }

        setReports(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setError("Could not load reports.");
          setReports([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = reports?.length ?? 0;
  const loading = reports === null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf0]">Reports</h1>
          <p className="text-sm text-[#8b90a0] mt-0.5">
            {loading
              ? "Loading…"
              : `${count} report${count !== 1 ? "s" : ""}`}
          </p>
          {!loading ? (
            <p className="text-sm text-[#6b7080] mt-2 max-w-2xl">
              Open a report to work in the workspace. Use{" "}
              <span className="text-[#8b90a0]">Edit details</span> when you only
              need case or metadata changes.
            </p>
          ) : null}
        </div>
        <Link
          href="/dashboard/reports/new"
          className="inline-flex items-center gap-2 rounded-md bg-[#4f7ef5] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors"
        >
          <Plus size={15} />
          New Report
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-12 text-center">
          <p className="text-sm text-[#8b90a0]">Loading reports…</p>
        </div>
      ) : (
        <ReportsTable reports={reports ?? []} />
      )}
    </div>
  );
}
