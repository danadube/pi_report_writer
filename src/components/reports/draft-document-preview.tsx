"use client";

import { useMemo, useState } from "react";
import type { DraftItemState } from "@/types/draft";
import type { DraftBlock, DraftDocument, DraftSection } from "@/types/draft-document";

export interface DraftWorkflowControls {
  onPatchState: (draftItemId: string, state: DraftItemState) => Promise<void>;
  pendingItemId: string | null;
  readOnly: boolean;
}

export interface DraftDocumentPreviewProps {
  document: DraftDocument | null;
  /** Fatal: cannot show document (load failure). */
  error: string | null;
  /** Shown when document loads but a mutation failed; does not replace the document. */
  actionError?: string | null;
  /** @deprecated Only used when this component is used without a parent workflow. */
  noActiveDraft?: boolean;
  /** Explains active vs latest-only display (never implies backend promotion). */
  caption?: string | null;
  captionTone?: "default" | "amber";
  workflow?: DraftWorkflowControls;
}

type ExcludedEntry = { pathLabel: string; block: DraftBlock };

function displayText(block: DraftBlock): string {
  const t = block.displayPayload.display_text;
  return typeof t === "string" ? t : "";
}

function displayLabel(block: DraftBlock): string | null {
  const l = block.displayPayload.label;
  return typeof l === "string" && l.trim() ? l : null;
}

function collectExcluded(doc: DraftDocument): ExcludedEntry[] {
  const out: ExcludedEntry[] = [];
  for (const sec of doc.reportSections) {
    for (const b of sec.blocks) {
      if (b.state === "excluded") {
        out.push({ pathLabel: `Report · ${sec.sectionLabel}`, block: b });
      }
    }
  }
  for (const sub of doc.subjects) {
    for (const sec of sub.sections) {
      for (const b of sec.blocks) {
        if (b.state === "excluded") {
          out.push({ pathLabel: `${sub.subjectLabel} · ${sec.sectionLabel}`, block: b });
        }
      }
    }
  }
  return out;
}

function StateControls({
  block,
  workflow,
}: {
  block: DraftBlock;
  workflow: DraftWorkflowControls;
}) {
  const disabled = workflow.readOnly || workflow.pendingItemId === block.draftItemId;

  const btn = (label: string, state: DraftItemState, active: boolean) => (
    <button
      key={state}
      type="button"
      disabled={disabled}
      onClick={() => workflow.onPatchState(block.draftItemId, state)}
      className={
        active
          ? "rounded border border-[#4f7ef5] bg-[#4f7ef5]/20 px-2 py-0.5 text-[11px] text-[#e8eaf0]"
          : "rounded border border-[#2a2f42] px-2 py-0.5 text-[11px] text-[#8b90a0] hover:bg-[#1e2130]"
      }
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Line state">
      {btn("Include", "included", block.state === "included")}
      {btn("Exclude", "excluded", block.state === "excluded")}
      {btn("Review", "review_needed", block.state === "review_needed")}
    </div>
  );
}

function DraftBlockView({
  block,
  workflow,
}: {
  block: DraftBlock;
  workflow?: DraftWorkflowControls;
}) {
  const label = displayLabel(block);
  const text = displayText(block);

  if (block.blockType === "warning") {
    return (
      <div className="space-y-1">
        <div
          role="alert"
          className="rounded-md border-2 border-amber-500/70 bg-amber-950/40 px-3 py-2.5 text-sm text-amber-100"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/95 mb-1">
            Warning
          </p>
          {label ? <p className="text-xs text-amber-200/80 mb-1">{label}</p> : null}
          <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
        </div>
        {workflow ? <StateControls block={block} workflow={workflow} /> : null}
      </div>
    );
  }

  if (block.state === "review_needed") {
    return (
      <div className="space-y-1">
        <div className="rounded-md border border-amber-600/50 bg-amber-950/25 px-3 py-2 text-sm text-[#e8eaf0]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90 mb-1">
            Review needed
          </p>
          {label ? (
            <span className="text-xs text-[#8b90a0] block mb-0.5">{label}</span>
          ) : null}
          <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
        </div>
        {workflow ? <StateControls block={block} workflow={workflow} /> : null}
      </div>
    );
  }

  const isManual = block.blockType === "manual_note";
  return (
    <div className="space-y-1">
      <div
        className={
          isManual
            ? "rounded-md border border-[#3d4a66] bg-[#1a1f2e] px-3 py-2 text-sm text-[#e8eaf0]"
            : "rounded-md border border-[#2a2f42] bg-[#12141c]/80 px-3 py-2 text-sm text-[#e8eaf0]"
        }
      >
        {isManual ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7a99] mb-1">
            Manual note
          </p>
        ) : null}
        {label ? <span className="text-xs text-[#8b90a0] block mb-0.5">{label}</span> : null}
        <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
      </div>
      {workflow ? <StateControls block={block} workflow={workflow} /> : null}
    </div>
  );
}

function SectionBlocks({
  section,
  workflow,
}: {
  section: DraftSection;
  workflow?: DraftWorkflowControls;
}) {
  const visible = section.blocks.filter((b) => b.state !== "excluded");
  if (visible.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      {visible.map((block) => (
        <DraftBlockView key={block.draftItemId} block={block} workflow={workflow} />
      ))}
    </div>
  );
}

export function DraftDocumentPreview({
  document,
  error,
  actionError,
  noActiveDraft,
  caption,
  captionTone = "default",
  workflow,
}: DraftDocumentPreviewProps) {
  const [showExcluded, setShowExcluded] = useState(false);

  const excluded = useMemo(() => (document ? collectExcluded(document) : []), [document]);

  if (error) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-preview-heading">
        <h2 id="draft-preview-heading" className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
          Draft preview
        </h2>
        <p className="text-sm text-red-300/90" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (noActiveDraft || !document) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-preview-heading">
        <h2 id="draft-preview-heading" className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2">
          Draft preview
        </h2>
        <p className="text-sm text-[#8b90a0]">
          {noActiveDraft
            ? "No active draft version. Create a draft from the draft API or seed a version to see an assembled preview here."
            : "Nothing to preview."}
        </p>
      </section>
    );
  }

  const stale = document.status === "stale";

  return (
    <section className="scroll-mt-10 space-y-4" aria-labelledby="draft-preview-heading">
      {actionError ? (
        <p className="text-sm text-red-300/90 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">
          {actionError}
        </p>
      ) : null}

      <div>
        <h2 id="draft-preview-heading" className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
          Draft preview
        </h2>
        <p className="text-sm text-[#8b90a0] mt-1">
          Assembled from GET /document. Summary checkboxes above are separate from this durable draft.
        </p>
        {caption ? (
          <p
            className={
              captionTone === "amber"
                ? "text-xs text-amber-200/90 mt-2"
                : "text-xs text-[#8b90a0] mt-2"
            }
          >
            {caption}
          </p>
        ) : null}
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6b7080]">
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Version</dt>
            <dd className="tabular-nums text-[#e8eaf0]">{document.documentVersion}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Status</dt>
            <dd className="text-[#e8eaf0]">{document.status}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Extraction gen (snapshot)</dt>
            <dd className="tabular-nums text-[#e8eaf0]">{document.extractionGeneration}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Blocking warnings</dt>
            <dd className={document.blockingWarnings ? "text-amber-400" : "text-[#e8eaf0]"}>
              {document.blockingWarnings ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
      </div>

      {stale ? (
        <div
          role="alert"
          className="rounded-lg border-2 border-amber-600/80 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
        >
          <p className="font-semibold text-amber-200">This draft is stale</p>
          <p className="mt-1 text-amber-100/90">
            Extraction has changed since this draft was created. Review system notices and lines below before relying
            on this version.
          </p>
        </div>
      ) : null}

      <div className="space-y-6">
        {document.reportSections.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7080]">Report</h3>
            {document.reportSections.map((sec) => {
              const hasVisible = sec.blocks.some((b) => b.state !== "excluded");
              if (!hasVisible) return null;
              return (
                <article key={sec.sectionKey} className="space-y-2">
                  <h4 className="text-xs font-medium text-[#e8eaf0]">{sec.sectionLabel}</h4>
                  <SectionBlocks section={sec} workflow={workflow} />
                </article>
              );
            })}
          </div>
        ) : null}

        {document.subjects.map((sub) => (
          <div key={sub.subjectIndex} className="space-y-4">
            <h3 className="text-sm font-medium text-[#e8eaf0] border-b border-[#2a2f42] pb-1">{sub.subjectLabel}</h3>
            {sub.sections.map((sec) => {
              const hasVisible = sec.blocks.some((b) => b.state !== "excluded");
              if (!hasVisible) return null;
              return (
                <article key={`${sub.subjectIndex}-${sec.sectionKey}`} className="space-y-2">
                  <h4 className="text-xs font-medium text-[#8b90a0]">{sec.sectionLabel}</h4>
                  <SectionBlocks section={sec} workflow={workflow} />
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {excluded.length > 0 ? (
        <div className="rounded-lg border border-[#2a2f42] bg-[#12141c]/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowExcluded((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-[#8b90a0] hover:bg-[#1e2130]/80"
          >
            <span>Show excluded items ({excluded.length})</span>
            <span className="text-[#6b7080]">{showExcluded ? "▼" : "▶"}</span>
          </button>
          {showExcluded ? (
            <ul className="border-t border-[#2a2f42] px-3 py-2 space-y-3 text-sm text-[#6b7080]">
              {excluded.map(({ pathLabel, block }) => (
                <li key={block.draftItemId} className="wrap-break-word">
                  <span className="text-[10px] uppercase tracking-wide block text-[#5a6070]">{pathLabel}</span>
                  <div className="mt-1 space-y-1">
                    <span className="line-through text-[#8b90a0] block">{displayText(block)}</span>
                    {workflow ? <StateControls block={block} workflow={workflow} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
