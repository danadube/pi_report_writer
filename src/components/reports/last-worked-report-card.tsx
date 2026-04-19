"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  LAST_WORKED_REPORT_STORAGE_KEY,
  LAST_WORKED_REPORT_UPDATED_EVENT,
  readLastWorkedReport,
  type LastWorkedReportSnapshot,
} from "@/lib/last-worked-report";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === LAST_WORKED_REPORT_STORAGE_KEY || e.key === null) {
      onStoreChange();
    }
  };
  const onSameTab = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(LAST_WORKED_REPORT_UPDATED_EVENT, onSameTab);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LAST_WORKED_REPORT_UPDATED_EVENT, onSameTab);
  };
}

export function LastWorkedReportCard() {
  const snapshot = useSyncExternalStore(
    subscribe,
    readLastWorkedReport,
    () => null as LastWorkedReportSnapshot | null
  );

  if (!snapshot) {
    return null;
  }

  const title =
    snapshot.subject_name.trim().length > 0 ? snapshot.subject_name : "Untitled subject";
  const caseLine =
    snapshot.case_name.trim().length > 0 ? snapshot.case_name : "No case number";

  return (
    <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#2a2f42] bg-[#12141c]"
            aria-hidden
          >
            <FileText className="text-[#4f7ef5]" size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
              Last worked report
            </p>
            <p className="text-base font-medium text-[#e8eaf0] truncate mt-0.5">{title}</p>
            <p className="text-sm text-[#8b90a0] truncate">{caseLine}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/reports/${encodeURIComponent(snapshot.id)}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#4f7ef5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors"
        >
          Continue
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
