"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SummaryDraftPreview } from "@/components/reports/summary-draft-preview";
import type { SummaryPrepPayload } from "@/types/summary-candidates";

interface SummarySelectionReviewProps {
  reportId: string;
}

function initialSelection(payload: SummaryPrepPayload): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const block of payload.subject_blocks) {
    for (const sec of block.sections) {
      for (const c of sec.candidates) {
        m[c.id] = c.selected_by_default;
      }
    }
  }
  return m;
}

export function SummarySelectionReview({ reportId }: SummarySelectionReviewProps) {
  const [payload, setPayload] = useState<SummaryPrepPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    fetch(`/api/reports/${reportId}/summary-prep`)
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        return res.json() as Promise<SummaryPrepPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setSelected(initialSelection(data));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load summary prep.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const totalCandidates = useMemo(() => {
    if (!payload) return 0;
    let n = 0;
    for (const b of payload.subject_blocks) {
      for (const s of b.sections) {
        n += s.candidates.length;
      }
    }
    return n;
  }, [payload]);

  const selectedCount = useMemo(() => {
    if (!payload) return 0;
    let n = 0;
    for (const b of payload.subject_blocks) {
      for (const s of b.sections) {
        for (const c of s.candidates) {
          if (selected[c.id] === true) n += 1;
        }
      }
    }
    return n;
  }, [payload, selected]);

  if (loading) {
    return (
      <section id="summary-selection" className="scroll-mt-10">
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
          Summary selection
        </h2>
        <p className="text-sm text-[#8b90a0]">Loading candidates…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section id="summary-selection" className="scroll-mt-10">
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
          Summary selection
        </h2>
        <p className="text-sm text-red-300/90" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!payload || totalCandidates === 0) {
    return (
      <section id="summary-selection" className="scroll-mt-10">
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
          Summary selection
        </h2>
        <p className="text-sm text-[#8b90a0]">
          No extracted fields yet. Upload and run extraction on a source document to preview summary
          sections here.
        </p>
      </section>
    );
  }

  return (
    <section id="summary-selection" className="scroll-mt-10 space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
          Summary selection
        </h2>
        <p className="text-sm text-[#8b90a0] mt-1">
          Choose lines to include; the draft summary below updates immediately. Defaults follow
          ranking rules from extraction — adjust as needed.
        </p>
        <p className="text-xs text-[#6b7080] mt-2">
          {selectedCount} of {totalCandidates} lines selected
        </p>
      </div>

      <div className="space-y-4">
        {payload.subject_blocks.map((block) => (
          <article
            key={block.subject_key}
            className="rounded-lg border border-[#2a2f42] bg-[#161922] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#1e2130] bg-[#12141c]/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7080]">
                  {block.badge_label}
                </span>
                <h3 className="text-sm font-medium text-[#e8eaf0]">{block.title}</h3>
              </div>
            </div>

            <div className="px-4 py-4 space-y-5">
              {block.sections.map((sec) => (
                <div key={sec.section}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#8b90a0] mb-2">
                    {sec.title}
                  </h4>
                  <ul className="space-y-2">
                    {sec.candidates.map((c) => {
                      const isOn = selected[c.id] ?? false;
                      return (
                        <li
                          key={c.id}
                          className="flex items-start gap-3 rounded-md border border-[#1e2130] bg-[#12141c]/60 px-3 py-2"
                        >
                          <label className="flex flex-1 min-w-0 cursor-pointer gap-2 items-start">
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0 rounded border-[#2a2f42]"
                              checked={isOn}
                              onChange={() => toggle(c.id)}
                            />
                            <span className="min-w-0 flex-1">
                              {c.label ? (
                                <span className="text-[11px] text-[#8b90a0] block mb-0.5">
                                  {c.label}
                                </span>
                              ) : null}
                              <span className="text-sm text-[#e8eaf0] wrap-break-word">{c.display_text}</span>
                              {c.entity_kind === "address" && c.address_date_metadata?.trim() ? (
                                <span className="text-xs text-[#8b90a0] block mt-1">
                                  {c.address_date_metadata.trim()}
                                </span>
                              ) : null}
                              {c.source_reference?.file_name ? (
                                <span className="text-[10px] text-[#6b7080] block mt-1">
                                  Source: {c.source_reference.file_name}
                                </span>
                              ) : null}
                            </span>
                          </label>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {c.selected_by_default ? (
                              <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
                                Default on
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wide text-[#6b7080]">
                                Default off
                              </span>
                            )}
                            {c.ranking_score != null ? (
                              <span className="text-[10px] text-[#6b7080] tabular-nums">
                                score {c.ranking_score.toFixed(0)}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <SummaryDraftPreview payload={payload} selected={selected} />
    </section>
  );
}
