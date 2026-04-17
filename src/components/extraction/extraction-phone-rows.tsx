"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExtractedPhone } from "@/types";
import { Check, X } from "lucide-react";

function InclusionHint({ included }: { included: boolean }) {
  if (included) {
    return null;
  }
  return (
    <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-400/80 shrink-0">
      Excluded from report
    </span>
  );
}

export interface ExtractionPhoneRowsProps {
  reportId: string;
  /** Initial rows from the server; local state syncs for toggles and refresh. */
  initialPhones: ExtractedPhone[];
}

/**
 * Phone list with include/exclude toggles (persists `include_in_report`).
 * Row layout matches extraction-review-readonly for consistency; inline edit can extend this later.
 */
export function ExtractionPhoneRows({ reportId, initialPhones }: ExtractionPhoneRowsProps) {
  const router = useRouter();
  const [phones, setPhones] = useState<ExtractedPhone[]>(initialPhones);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setPhones(initialPhones);
  }, [initialPhones]);

  async function toggleInclude(id: string, nextIncluded: boolean) {
    const prev = phones.find((p) => p.id === id);
    if (!prev) {
      return;
    }
    setError(null);
    setPhones((rows) =>
      rows.map((p) => (p.id === id ? { ...p, include_in_report: nextIncluded } : p))
    );
    setPendingId(id);
    try {
      const res = await fetch(
        `/api/reports/${encodeURIComponent(reportId)}/extracted-phones/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ include_in_report: nextIncluded }),
        }
      );
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setPhones((rows) =>
          rows.map((p) => (p.id === id ? { ...p, include_in_report: prev.include_in_report } : p))
        );
        setError(typeof json?.error === "string" ? json.error : "Could not save");
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-[#8b90a0] mb-2">
        Toggle include to hide noisy numbers from the generated report.
      </p>
      {error ? (
        <p className="text-xs text-red-300/90 mb-1" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {phones.map((p) => {
          const included = p.include_in_report;
          const busy = pendingId === p.id;
          return (
            <li key={p.id} className="flex items-start gap-3 text-sm">
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleInclude(p.id, !included)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50 ${
                  included
                    ? "border-[#4f7ef5] bg-[#4f7ef5]"
                    : "border-[#2a2f42] hover:border-[#4f7ef5]/50"
                }`}
                aria-pressed={included}
                aria-label={included ? "Included in report; click to exclude" : "Excluded; click to include"}
              >
                {included ? <Check size={12} className="text-white" /> : <X size={12} className="text-transparent" />}
              </button>
              <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
                <span
                  className={
                    included ? "text-[#e8eaf0]" : "text-[#8b90a0] line-through"
                  }
                >
                  {p.phone_number}
                </span>
                <InclusionHint included={included} />
                {p.phone_type ? (
                  <span className="text-xs text-[#8b90a0]">({p.phone_type})</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
