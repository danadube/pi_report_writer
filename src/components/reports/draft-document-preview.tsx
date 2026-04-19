"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTION_KEY_REPORT_NOTES } from "@/lib/drafts/draft-item-registry";
import type { DraftItemState } from "@/types/draft";
import type { DraftBlock, DraftDocument, DraftSection } from "@/types/draft-document";

/** CaseRender reference: docs/reference/CaseRender_Brand_Identity.html */
const cr = {
  midnight: "#0D1B2E",
  deepNavy: "#1A2E4A",
  steelBlue: "#0D4F8C",
  gold: "#C8901A",
  chalk: "#F0EEE9",
  slate: "#4A5768",
};

export interface DraftWorkflowControls {
  onPatchState: (draftItemId: string, state: DraftItemState) => Promise<void>;
  pendingItemId: string | null;
  readOnly: boolean;
}

export interface ManualNoteActions {
  canEdit: boolean;
  onSave: (draftItemId: string, displayText: string) => Promise<void>;
  onDelete: (draftItemId: string) => Promise<void>;
}

export interface DraftDocumentPreviewProps {
  document: DraftDocument | null;
  error: string | null;
  actionError?: string | null;
  noActiveDraft?: boolean;
  caption?: string | null;
  captionTone?: "default" | "amber";
  workflow?: DraftWorkflowControls;
  manualNoteActions?: ManualNoteActions;
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

function isReportManualNoteBlock(block: DraftBlock): boolean {
  return (
    block.blockType === "manual_note" &&
    block.displayPayload.section_key === SECTION_KEY_REPORT_NOTES
  );
}

function ReportManualNoteBlock({
  block,
  workflow,
  manualNoteActions,
}: {
  block: DraftBlock;
  workflow?: DraftWorkflowControls;
  manualNoteActions?: ManualNoteActions;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => displayText(block));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraft(displayText(block));
  }, [block]);

  const label = displayLabel(block);
  const showActions = manualNoteActions?.canEdit === true;

  const save = async () => {
    if (!manualNoteActions) return;
    setSaving(true);
    try {
      await manualNoteActions.onSave(block.draftItemId, draft);
      setEditing(false);
    } catch {
      // Parent workflow surfaces errors via actionError / alerts
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!manualNoteActions) return;
    setDeleting(true);
    try {
      await manualNoteActions.onDelete(block.draftItemId);
    } catch {
      // Parent workflow surfaces errors via actionError / alerts
    } finally {
      setDeleting(false);
    }
  };

  const excludedLine = block.state === "excluded";

  return (
    <div className="space-y-1">
      <div
        className="rounded-md border px-3 py-2 text-sm font-sans"
        style={{
          borderColor: `${cr.steelBlue}55`,
          backgroundColor: `${cr.midnight}ee`,
          color: cr.chalk,
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: cr.slate }}>
          Manual note
        </p>
        {label ? (
          <span className="text-xs block mb-0.5" style={{ color: cr.slate }}>
            {label}
          </span>
        ) : null}
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full rounded border px-2 py-1.5 text-sm font-sans mt-1"
            style={{ borderColor: cr.deepNavy, backgroundColor: cr.midnight, color: cr.chalk }}
          />
        ) : (
          <p
            className={`whitespace-pre-wrap wrap-break-word ${excludedLine ? "line-through opacity-80" : ""}`}
          >
            {displayText(block)}
          </p>
        )}
        {showActions ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={saving || draft.trim().length === 0}
                  onClick={() => void save()}
                  className="rounded px-2 py-1 text-[11px] font-sans font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: cr.steelBlue }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setDraft(displayText(block));
                  }}
                  className="rounded border px-2 py-1 text-[11px] font-sans"
                  style={{ borderColor: cr.deepNavy, color: cr.slate }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded border px-2 py-1 text-[11px] font-sans"
                  style={{ borderColor: cr.deepNavy, color: cr.chalk }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void del()}
                  className="rounded px-2 py-1 text-[11px] font-sans text-red-300/90 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      {workflow ? <StateControls block={block} workflow={workflow} /> : null}
    </div>
  );
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
      className="rounded border px-2 py-0.5 text-[11px] font-sans disabled:opacity-40"
      style={
        active
          ? {
              borderColor: cr.steelBlue,
              backgroundColor: `${cr.steelBlue}33`,
              color: cr.chalk,
            }
          : {
              borderColor: cr.deepNavy,
              color: cr.slate,
            }
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
  manualNoteActions,
}: {
  block: DraftBlock;
  workflow?: DraftWorkflowControls;
  manualNoteActions?: ManualNoteActions;
}) {
  const label = displayLabel(block);
  const text = displayText(block);

  if (isReportManualNoteBlock(block)) {
    return (
      <ReportManualNoteBlock block={block} workflow={workflow} manualNoteActions={manualNoteActions} />
    );
  }

  if (block.blockType === "warning") {
    return (
      <div className="space-y-1">
        <div
          role="alert"
          className="rounded-md border px-3 py-2.5 text-sm font-sans"
          style={{
            borderColor: `${cr.gold}99`,
            backgroundColor: `${cr.midnight}cc`,
            color: cr.chalk,
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: cr.gold }}>
            Warning
          </p>
          {label ? <p className="text-xs mb-1" style={{ color: `${cr.chalk}cc` }}>{label}</p> : null}
          <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
        </div>
        {workflow ? <StateControls block={block} workflow={workflow} /> : null}
      </div>
    );
  }

  if (block.state === "review_needed") {
    return (
      <div className="space-y-1">
        <div
          className="rounded-md border px-3 py-2 text-sm font-sans"
          style={{ borderColor: `${cr.gold}55`, backgroundColor: `${cr.deepNavy}99`, color: cr.chalk }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: cr.gold }}>
            Review needed
          </p>
          {label ? (
            <span className="text-xs block mb-0.5" style={{ color: cr.slate }}>
              {label}
            </span>
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
        className="rounded-md border px-3 py-2 text-sm font-sans"
        style={{
          borderColor: isManual ? `${cr.steelBlue}55` : cr.deepNavy,
          backgroundColor: isManual ? `${cr.midnight}ee` : `${cr.midnight}aa`,
          color: cr.chalk,
        }}
      >
        {isManual ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: cr.slate }}>
            Manual note
          </p>
        ) : null}
        {label ? (
          <span className="text-xs block mb-0.5" style={{ color: cr.slate }}>
            {label}
          </span>
        ) : null}
        <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
      </div>
      {workflow ? <StateControls block={block} workflow={workflow} /> : null}
    </div>
  );
}

function SectionBlocks({
  section,
  workflow,
  manualNoteActions,
}: {
  section: DraftSection;
  workflow?: DraftWorkflowControls;
  manualNoteActions?: ManualNoteActions;
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
          workflow={workflow}
          manualNoteActions={manualNoteActions}
        />
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
  manualNoteActions,
}: DraftDocumentPreviewProps) {
  const [showExcluded, setShowExcluded] = useState(false);

  const excluded = useMemo(() => (document ? collectExcluded(document) : []), [document]);

  if (error) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-preview-heading">
        <h2
          id="draft-preview-heading"
          className="font-serif text-sm mb-2"
          style={{ color: cr.chalk }}
        >
          Draft preview
        </h2>
        <p className="text-sm text-red-300/90 font-sans" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (noActiveDraft || !document) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-preview-heading">
        <h2 id="draft-preview-heading" className="font-serif text-sm mb-2" style={{ color: cr.chalk }}>
          Draft preview
        </h2>
        <p className="text-sm font-sans" style={{ color: cr.slate }}>
          {noActiveDraft
            ? "No draft document loaded."
            : "Nothing to preview."}
        </p>
      </section>
    );
  }

  const stale = document.status === "stale";

  return (
    <section
      className="scroll-mt-10 space-y-4 rounded-xl border p-5"
      style={{ borderColor: cr.deepNavy, backgroundColor: `${cr.midnight}cc` }}
      aria-labelledby="draft-preview-heading"
    >
      {actionError ? (
        <p
          className="text-sm rounded-md border px-3 py-2 font-sans text-red-200"
          style={{ borderColor: "rgba(180, 60, 60, 0.4)", backgroundColor: "rgba(40, 15, 15, 0.5)" }}
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      <div>
        <h2 id="draft-preview-heading" className="font-serif text-base font-normal" style={{ color: cr.chalk }}>
          Draft preview
        </h2>
        <p className="text-xs font-sans mt-1 leading-relaxed" style={{ color: cr.slate }}>
          Assembled from GET /document. Server truth for structure and line state.
        </p>
        {caption ? (
          <p
            className="text-xs font-sans mt-2 leading-snug"
            style={{ color: captionTone === "amber" ? `${cr.chalk}ee` : cr.slate }}
          >
            {caption}
          </p>
        ) : null}
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-sans" style={{ color: cr.slate }}>
          <div className="flex gap-1.5">
            <dt>Version</dt>
            <dd className="tabular-nums" style={{ color: cr.chalk }}>
              {document.documentVersion}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Status</dt>
            <dd className="tabular-nums" style={{ color: cr.chalk }}>
              {document.status}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Extraction snapshot</dt>
            <dd className="tabular-nums" style={{ color: cr.chalk }}>
              {document.extractionGeneration}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Blocking warnings</dt>
            <dd style={{ color: document.blockingWarnings ? cr.gold : cr.chalk }}>
              {document.blockingWarnings ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
      </div>

      {stale ? (
        <div
          role="alert"
          className="rounded-lg border px-4 py-3 text-sm font-sans"
          style={{
            borderColor: `${cr.gold}aa`,
            backgroundColor: `${cr.deepNavy}dd`,
            color: cr.chalk,
          }}
        >
          <p className="font-semibold font-serif" style={{ color: cr.gold }}>
            This draft is stale
          </p>
          <p className="mt-1 opacity-95">
            Extraction has changed since this draft was created. Review notices and lines before relying on this
            version.
          </p>
        </div>
      ) : null}

      <div className="space-y-6">
        {document.reportSections.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-[10px] font-sans font-semibold uppercase tracking-widest" style={{ color: cr.slate }}>
              Report
            </h3>
            {document.reportSections.map((sec) => {
              const hasVisible = sec.blocks.some((b) => b.state !== "excluded");
              if (!hasVisible) return null;
              return (
                <article key={sec.sectionKey} className="space-y-2">
                  <h4 className="text-sm font-serif" style={{ color: cr.chalk }}>
                    {sec.sectionLabel}
                  </h4>
                  <SectionBlocks
                    section={sec}
                    workflow={workflow}
                    manualNoteActions={manualNoteActions}
                  />
                </article>
              );
            })}
          </div>
        ) : null}

        {document.subjects.map((sub) => (
          <div key={sub.subjectIndex} className="space-y-4">
            <h3
              className="text-sm font-serif border-b pb-1"
              style={{ color: cr.chalk, borderColor: cr.deepNavy }}
            >
              {sub.subjectLabel}
            </h3>
            {sub.sections.map((sec) => {
              const hasVisible = sec.blocks.some((b) => b.state !== "excluded");
              if (!hasVisible) return null;
              return (
                <article key={`${sub.subjectIndex}-${sec.sectionKey}`} className="space-y-2">
                  <h4 className="text-xs font-sans uppercase tracking-wide" style={{ color: cr.slate }}>
                    {sec.sectionLabel}
                  </h4>
                  <SectionBlocks
                    section={sec}
                    workflow={workflow}
                    manualNoteActions={manualNoteActions}
                  />
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {excluded.length > 0 ? (
        <div
          className="rounded-lg border overflow-hidden font-sans"
          style={{ borderColor: cr.deepNavy, backgroundColor: `${cr.midnight}99` }}
        >
          <button
            type="button"
            onClick={() => setShowExcluded((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
            style={{ color: cr.slate }}
          >
            <span>Show excluded items ({excluded.length})</span>
            <span>{showExcluded ? "▼" : "▶"}</span>
          </button>
          {showExcluded ? (
            <ul className="border-t px-3 py-2 space-y-3 text-sm" style={{ borderColor: cr.deepNavy }}>
              {excluded.map(({ pathLabel, block }) => (
                <li key={block.draftItemId} className="wrap-break-word">
                  <span className="text-[10px] uppercase tracking-wide block" style={{ color: cr.slate }}>
                    {pathLabel}
                  </span>
                  <div className="mt-1 space-y-1">
                    {isReportManualNoteBlock(block) ? (
                      <ReportManualNoteBlock
                        block={block}
                        workflow={workflow}
                        manualNoteActions={manualNoteActions}
                      />
                    ) : (
                      <>
                        <span className="line-through block" style={{ color: `${cr.slate}cc` }}>
                          {displayText(block)}
                        </span>
                        {workflow ? <StateControls block={block} workflow={workflow} /> : null}
                      </>
                    )}
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
