"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DraftBlock, DraftDocument, DraftSection } from "@/types/draft-document";
import type { DraftItemState } from "@/types/draft";

export interface DraftDocumentPreviewProps {
  document: DraftDocument | null;
  /** Set when draft-versions or document request failed. */
  error: string | null;
  /** True when versions loaded successfully but no row has status active. */
  noActiveDraft: boolean;
  /** Allow include / exclude / review controls (active or stale draft). */
  canEdit?: boolean;
  onPatchItem?: (itemId: string, state: DraftItemState) => void | Promise<void>;
  patchingItemId?: string | null;
  /** For stale banner: number of items listed in Review Required (same document walk as panel). */
  reviewEntryCount?: number;
  /** Hash link to Review Required panel, e.g. #review-required-panel */
  reviewPanelAnchor?: string;
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

function needsAttentionControls(block: DraftBlock): boolean {
  if (block.state === "excluded") return false;
  if (block.blockType === "warning") return true;
  return block.state === "review_needed";
}

function ItemActions({
  block,
  canEdit,
  disabled,
  onPatchItem,
}: {
  block: DraftBlock;
  canEdit: boolean;
  disabled: boolean;
  onPatchItem?: (itemId: string, state: DraftItemState) => void | Promise<void>;
}) {
  if (!canEdit || !onPatchItem || !needsAttentionControls(block)) return null;

  const run = (state: DraftItemState) => {
    void onPatchItem(block.draftItemId, state);
  };

  const base =
    "text-[11px] px-2 py-1 rounded border font-sans transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const idle = "border-[#2f4a6e] text-[#b8c5d9] hover:bg-[#1a2438]";
  const active = "border-[#C8901A]/60 text-[#C8901A] bg-[#C8901A]/5";

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#243552]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => run("included")}
        className={`${base} ${block.state === "included" ? active : idle}`}
      >
        Include
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => run("excluded")}
        className={`${base} ${block.state === "excluded" ? active : idle}`}
      >
        Exclude
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => run("review_needed")}
        className={`${base} ${block.state === "review_needed" ? active : idle}`}
      >
        Keep as review needed
      </button>
    </div>
  );
}

function DraftBlockView({
  block,
  canEdit,
  patchingItemId,
  onPatchItem,
}: {
  block: DraftBlock;
  canEdit: boolean;
  patchingItemId: string | null;
  onPatchItem?: (itemId: string, state: DraftItemState) => void | Promise<void>;
}) {
  const label = displayLabel(block);
  const text = displayText(block);
  const busy = patchingItemId === block.draftItemId;

  if (block.blockType === "warning") {
    return (
      <div
        role="alert"
        className="rounded-md border border-[#1e3050] bg-[#0a1018] px-3 py-2.5 text-sm text-[#e8eaf0] shadow-[inset_0_0_0_1px_rgba(200,144,26,0.12)]"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C8901A] mb-1 font-sans">
          System notice
        </p>
        {label ? <p className="text-xs text-[#8b90a0] mb-1 font-sans">{label}</p> : null}
        <p className="whitespace-pre-wrap wrap-break-word font-sans">{text}</p>
        <ItemActions block={block} canEdit={canEdit} disabled={busy} onPatchItem={onPatchItem} />
      </div>
    );
  }

  if (block.state === "review_needed") {
    return (
      <div className="rounded-md border border-[#243552] bg-[#0a0e14] px-3 py-2 text-sm text-[#e8eaf0]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C8901A] mb-1 font-sans">
          Review needed
        </p>
        {label ? (
          <span className="text-xs text-[#8b90a0] block mb-0.5 font-sans">{label}</span>
        ) : null}
        <p className="whitespace-pre-wrap wrap-break-word font-sans">{text}</p>
        <ItemActions block={block} canEdit={canEdit} disabled={busy} onPatchItem={onPatchItem} />
      </div>
    );
  }

  const isManual = block.blockType === "manual_note";
  return (
    <div
      className={
        isManual
          ? "rounded-md border border-[#3d4a66] bg-[#1a1f2e] px-3 py-2 text-sm text-[#e8eaf0]"
          : "rounded-md border border-[#2a2f42] bg-[#12141c]/80 px-3 py-2 text-sm text-[#e8eaf0]"
      }
    >
      {isManual ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7a99] mb-1 font-sans">
          Manual note
        </p>
      ) : null}
      {label ? <span className="text-xs text-[#8b90a0] block mb-0.5 font-sans">{label}</span> : null}
      <p className="whitespace-pre-wrap wrap-break-word font-sans">{text}</p>
    </div>
  );
}

function SectionBlocks({
  section,
  canEdit,
  patchingItemId,
  onPatchItem,
}: {
  section: DraftSection;
  canEdit: boolean;
  patchingItemId: string | null;
  onPatchItem?: (itemId: string, state: DraftItemState) => void | Promise<void>;
}) {
  const visible = section.blocks.filter((b) => b.state !== "excluded");
  if (visible.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      {visible.map((block) => (
        <DraftBlockView
          key={block.draftItemId}
          block={block}
          canEdit={canEdit}
          patchingItemId={patchingItemId}
          onPatchItem={onPatchItem}
        />
      ))}
    </div>
  );
}

export function DraftDocumentPreview({
  document,
  error,
  noActiveDraft,
  canEdit = false,
  onPatchItem,
  patchingItemId = null,
  reviewEntryCount = 0,
  reviewPanelAnchor = "#review-required-panel",
}: DraftDocumentPreviewProps) {
  const [showExcluded, setShowExcluded] = useState(false);

  const excluded = useMemo(() => (document ? collectExcluded(document) : []), [document]);

  if (error) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-preview-heading">
        <h2
          id="draft-preview-heading"
          className="font-serif text-lg text-[#e8eaf0] tracking-tight mb-2"
        >
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
        <h2
          id="draft-preview-heading"
          className="font-serif text-lg text-[#e8eaf0] tracking-tight mb-2"
        >
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
      <div>
        <h2
          id="draft-preview-heading"
          className="font-serif text-lg text-[#e8eaf0] tracking-tight"
        >
          Draft preview
        </h2>
        <p className="text-sm text-[#8b90a0] mt-1 font-sans">
          Assembled from the server draft document for the version you are viewing.
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6b7080] font-sans">
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Version</dt>
            <dd className="tabular-nums text-[#e8eaf0]">{document.documentVersion}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Status</dt>
            <dd className="tabular-nums text-[#e8eaf0]">{document.status}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Extraction gen (snapshot)</dt>
            <dd className="tabular-nums text-[#e8eaf0]">{document.extractionGeneration}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#8b90a0]">Blocking warnings</dt>
            <dd className={document.blockingWarnings ? "text-[#C8901A]" : "text-[#e8eaf0]"}>
              {document.blockingWarnings ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
      </div>

      {stale ? (
        <div
          role="alert"
          className="rounded-lg border border-[#1e3050] bg-[#0c1018] px-4 py-3 text-sm text-[#e8eaf0] shadow-[inset_0_1px_0_0_rgba(200,144,26,0.1)]"
        >
          <p className="font-serif text-base text-[#e8eaf0]">Draft out of date with extraction</p>
          <p className="mt-2 text-[#b8c5d9] font-sans leading-relaxed">
            Report extraction has changed since this draft was snapshotted. The lines below may no longer reflect the
            latest extracted facts. Treat this version as provisional until you complete review.
          </p>
          <p className="mt-2 text-[#8b90a0] font-sans">
            {reviewEntryCount > 0 ? (
              <>
                <span className="text-[#C8901A] font-medium tabular-nums">{reviewEntryCount}</span>
                {" item"}
                {reviewEntryCount === 1 ? "" : "s"} in the{" "}
                <Link
                  href={reviewPanelAnchor}
                  className="text-[#b8c5d9] underline underline-offset-2 hover:text-[#e8eaf0]"
                >
                  Review required
                </Link>{" "}
                panel still need a decision.
              </>
            ) : (
              <>
                Use the{" "}
                <Link
                  href={reviewPanelAnchor}
                  className="text-[#b8c5d9] underline underline-offset-2 hover:text-[#e8eaf0]"
                >
                  Review required
                </Link>{" "}
                panel to confirm system notices and flagged lines.
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="space-y-6">
        {document.reportSections.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-serif text-base text-[#e8eaf0] border-b border-[#243552] pb-1">
              Report
            </h3>
            {document.reportSections.map((sec) => {
              const hasVisible = sec.blocks.some((b) => b.state !== "excluded");
              if (!hasVisible) return null;
              return (
                <article key={sec.sectionKey} className="space-y-2">
                  <h4 className="text-xs font-medium text-[#8b90a0] font-sans tracking-wide uppercase">
                    {sec.sectionLabel}
                  </h4>
                  <SectionBlocks
                    section={sec}
                    canEdit={canEdit}
                    patchingItemId={patchingItemId}
                    onPatchItem={onPatchItem}
                  />
                </article>
              );
            })}
          </div>
        ) : null}

        {document.subjects.map((sub) => (
          <div key={sub.subjectIndex} className="space-y-4">
            <h3 className="font-serif text-base text-[#e8eaf0] border-b border-[#243552] pb-1">
              {sub.subjectLabel}
            </h3>
            {sub.sections.map((sec) => {
              const hasVisible = sec.blocks.some((b) => b.state !== "excluded");
              if (!hasVisible) return null;
              return (
                <article key={`${sub.subjectIndex}-${sec.sectionKey}`} className="space-y-2">
                  <h4 className="text-xs font-medium text-[#8b90a0] font-sans tracking-wide uppercase">
                    {sec.sectionLabel}
                  </h4>
                  <SectionBlocks
                    section={sec}
                    canEdit={canEdit}
                    patchingItemId={patchingItemId}
                    onPatchItem={onPatchItem}
                  />
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {excluded.length > 0 ? (
        <div className="rounded-lg border border-[#243552] bg-[#0a0e14]/80 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowExcluded((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-[#8b90a0] hover:bg-[#1e2130]/80 font-sans"
          >
            <span>Excluded lines ({excluded.length})</span>
            <span className="text-[#6b7080]">{showExcluded ? "▼" : "▶"}</span>
          </button>
          {showExcluded ? (
            <ul className="border-t border-[#243552] px-3 py-2 space-y-2 text-sm text-[#6b7080] font-sans">
              {excluded.map(({ pathLabel, block }) => (
                <li key={block.draftItemId} className="wrap-break-word">
                  <span className="text-[10px] uppercase tracking-wide block text-[#5a6070]">{pathLabel}</span>
                  <span className="line-through text-[#8b90a0]">{displayText(block)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
