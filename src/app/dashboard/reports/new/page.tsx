"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReportType } from "@/types";
import { REPORT_TEMPLATE_CONFIGS } from "@/lib/config/report-templates";
import { cn } from "@/lib/utils";

export default function NewReportPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);

  function handleContinue() {
    if (!selectedType) return;
    router.push(`/dashboard/reports/new/${selectedType.toLowerCase()}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e8eaf0]">New Report</h1>
        <p className="text-sm text-[#8b90a0] mt-0.5">
          Choose a report type to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.values(REPORT_TEMPLATE_CONFIGS).map((config) => (
          <button
            key={config.reportType}
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
          onClick={handleContinue}
          disabled={!selectedType}
          className="rounded-md bg-[#4f7ef5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors disabled:opacity-40"
        >
          Continue
        </button>
        <button
          onClick={() => router.back()}
          className="rounded-md border border-[#2a2f42] px-5 py-2.5 text-sm font-medium text-[#8b90a0] hover:bg-[#1e2130] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
