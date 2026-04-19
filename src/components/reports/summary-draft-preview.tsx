"use client";

import type { SummaryCandidate, SummaryPrepPayload } from "@/types/summary-candidates";
import { SUMMARY_SECTION_ORDER } from "@/types/summary-candidates";

interface SummaryDraftPreviewProps {
  payload: SummaryPrepPayload;
  /** Candidate id → included in draft */
  selected: Record<string, boolean>;
}

function selectedCandidates(candidates: SummaryCandidate[], selected: Record<string, boolean>) {
  return candidates.filter((c) => selected[c.id] === true);
}

/**
 * First-pass draft summary: structured bullets from the current checkbox selection only.
 * Not final prose — section headings + one line per selected candidate.
 */
export function SummaryDraftPreview({ payload, selected }: SummaryDraftPreviewProps) {
  let hasAny = false;
  for (const block of payload.subject_blocks) {
    for (const sec of block.sections) {
      if (selectedCandidates(sec.candidates, selected).length > 0) {
        hasAny = true;
        break;
      }
    }
    if (hasAny) break;
  }

  if (!hasAny) {
    return (
      <section id="summary-draft" className="scroll-mt-10 rounded-lg border border-[#2a2f42] bg-[#161922] px-4 py-4">
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
          Draft summary
        </h2>
        <p className="text-sm text-[#8b90a0]">
          Nothing selected yet. Check items under Summary selection to build a draft preview here.
        </p>
      </section>
    );
  }

  return (
    <section id="summary-draft" className="scroll-mt-10 space-y-3">
      <div>
        <h2 className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
          Draft summary
        </h2>
        <p className="text-sm text-[#8b90a0] mt-1">
          Structured preview from your current selection (updates as you toggle checkboxes).
        </p>
      </div>

      <div className="space-y-4">
        {payload.subject_blocks.map((block) => {
          const blockHasContent = block.sections.some(
            (sec) => selectedCandidates(sec.candidates, selected).length > 0
          );
          if (!blockHasContent) return null;

          return (
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
                {SUMMARY_SECTION_ORDER.map((sectionId) => {
                  const sec = block.sections.find((s) => s.section === sectionId);
                  if (!sec) return null;
                  const lines = selectedCandidates(sec.candidates, selected);
                  if (lines.length === 0) return null;

                  return (
                    <div key={sectionId}>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#8b90a0] mb-2">
                        {sec.title}
                      </h4>
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#e8eaf0]">
                        {lines.map((c) => (
                          <li key={c.id} className="wrap-break-word">
                            {c.label ? (
                              <span className="text-[#8b90a0] text-xs uppercase tracking-wide mr-2">
                                {c.label}:
                              </span>
                            ) : null}
                            {c.display_text}
                            {c.entity_kind === "address" && c.address_date_metadata?.trim() ? (
                              <span className="block text-[#8b90a0] text-xs mt-0.5">
                                {c.address_date_metadata.trim()}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
