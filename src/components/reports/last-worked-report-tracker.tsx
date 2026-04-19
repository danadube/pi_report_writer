"use client";

import { useEffect } from "react";
import { saveLastWorkedReport } from "@/lib/last-worked-report";
import type { Report } from "@/types";

export function LastWorkedReportTracker({ reportId }: { reportId: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) {
          return;
        }
        const report = (await res.json()) as Report;
        saveLastWorkedReport({
          id: report.id,
          subject_name: report.subject_name ?? "",
          case_name: report.case_name ?? "",
          updated_at: report.updated_at,
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  return null;
}
