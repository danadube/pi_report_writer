"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReportType } from "@/types";
import { REPORT_TEMPLATE_CONFIGS } from "@/lib/config/report-templates";
import { cn } from "@/lib/utils";

export default function NewReportPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selectedType) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: selectedType,
          status: "DRAFT",
          case_name: "",
          client_name: "",
          investigator_name: "",
          subject_name: "",
          report_date: null,
          summary_notes: null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };

      if (!res.ok) {
        setError(data.error ?? `Could not create report (${res.status})`);
        return;
      }

      if (!data.id) {
        setError("Invalid response from server.");
        return;
      }

      router.push(`/dashboard/reports/${data.id}/edit`);
      router.refresh();
    } catch {
      setError("Network error while creating the report.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e8eaf0]">New Report</h1>
        <p className="text-sm text-[#8b90a0] mt-0.5">
          Choose a report type to get started.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.values(REPORT_TEMPLATE_CONFIGS).map((config) => (
          <button
            key={config.reportType}
            type="button"
            onClick={() => setSelectedType(config.reportType)}
            className={cn(
              "rounded-lg border p-5 text-left transition-all",
              selectedType === config.reportType
                ? "border-[#4f7ef5] bg-[#1e2a4a]"
                : "border-[#2a2f42] bg-[#161922] hover:border-[#4f7ef5]/50"
            )}
          >
            <p className="font-medium text-[#e8eaf0]">{config.label}</p>
            <p className="text-sm text-[#8b90a0] mt-1">{config.description}</p>
            {config.supportsDocumentUpload && (
              <p className="text-xs text-[#4f7ef5] mt-2">
                Supports document upload
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedType || creating}
          className="rounded-md bg-[#4f7ef5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors disabled:opacity-40"
        >
          {creating ? "Creating…" : "Continue"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-[#2a2f42] px-5 py-2.5 text-sm font-medium text-[#8b90a0] hover:bg-[#1e2130] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
