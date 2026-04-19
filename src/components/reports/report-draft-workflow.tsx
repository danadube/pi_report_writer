"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DraftDocumentPreview } from "@/components/reports/draft-document-preview";
import { collectDraftReviewPanelEntries } from "@/lib/drafts/collect-draft-review-entries";
import type { DraftItemState, DraftVersionStatus, ReportDraftVersionDTO } from "@/types/draft";
import type { DraftDocument } from "@/types/draft-document";
import { DRAFT_REVIEW_PANEL_ID } from "@/components/reports/draft-review-panel-id";

const REVIEW_PANEL_ID = DRAFT_REVIEW_PANEL_ID;

/** CaseRender brand tokens (see docs/reference/CaseRender_Brand_Identity.html) */
const cr = {
  midnight: "#0D1B2E",
  deepNavy: "#1A2E4A",
  steelBlue: "#0D4F8C",
  gold: "#C8901A",
  chalk: "#F0EEE9",
  slate: "#4A5768",
};

interface ReportDraftWorkflowProps {
  reportId: string;
}

type VersionsResponse = { versions?: ReportDraftVersionDTO[] };

function pickWorkingVersion(
  versions: ReportDraftVersionDTO[]
): { version: ReportDraftVersionDTO; isOfficialActive: boolean } | null {
  if (versions.length === 0) {
    return null;
  }
  const active = versions.find((v) => v.status === "active");
  if (active) {
    return { version: active, isOfficialActive: true };
  }
  return { version: versions[0], isOfficialActive: false };
}

function formatVersionTimestamp(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

function statusBadgeLabel(status: DraftVersionStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "draft":
      return "Draft";
    case "stale":
      return "Stale";
    case "finalized":
      return "Finalized";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export function ReportDraftWorkflow({ reportId }: ReportDraftWorkflowProps) {
  const [versions, setVersions] = useState<ReportDraftVersionDTO[] | null>(null);
  const [viewedVersionId, setViewedVersionId] = useState<string | null>(null);
  const [document, setDocument] = useState<DraftDocument | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [creating, setCreating] = useState(false);
  const [branchingId, setBranchingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [patchingItemId, setPatchingItemId] = useState<string | null>(null);

  const sortedVersions = useMemo(() => {
    if (!versions?.length) return [];
    return [...versions].sort((a, b) => b.version_number - a.version_number);
  }, [versions]);

  const versionNumberById = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of versions ?? []) {
      m.set(v.id, v.version_number);
    }
    return m;
  }, [versions]);

  const viewedVersion = useMemo(
    () => (viewedVersionId && versions ? versions.find((v) => v.id === viewedVersionId) ?? null : null),
    [versions, viewedVersionId]
  );

  const activeVersion = useMemo(
    () => versions?.find((v) => v.status === "active") ?? null,
    [versions]
  );

  const isViewingActive = viewedVersion != null && activeVersion?.id === viewedVersion.id;
  const canEdit = isViewingActive && viewedVersion != null && viewedVersion.status !== "finalized";
  const workflowReadOnlyFinalized = viewedVersion != null && viewedVersion.status === "finalized";

  const reviewEntries = useMemo(() => collectDraftReviewPanelEntries(document), [document]);

  const scrollToReviewPanel = useCallback(() => {
    globalThis.document.getElementById(REVIEW_PANEL_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const loadDocument = useCallback(
    async (versionId: string) => {
      setLoadingDocument(true);
      setDocumentLoadError(null);
      try {
        const docRes = await fetch(
          `/api/reports/${reportId}/draft-versions/${versionId}/document`,
          { cache: "no-store" }
        );
        if (!docRes.ok) {
          const j = (await docRes.json().catch(() => ({}))) as { error?: string };
          setDocument(null);
          setDocumentLoadError(j.error ?? `Could not load draft document (${docRes.status}).`);
          return;
        }
        setDocument((await docRes.json()) as DraftDocument);
      } catch {
        setDocument(null);
        setDocumentLoadError("Could not load draft document.");
      } finally {
        setLoadingDocument(false);
      }
    },
    [reportId]
  );

  const loadVersions = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/draft-versions`, { cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setVersions(null);
        setListError(
          res.status === 401
            ? "Sign in to load drafts."
            : j.error ?? `Could not load draft versions (${res.status}).`
        );
        return;
      }
      const json = (await res.json()) as VersionsResponse;
      setVersions(json.versions ?? []);
    } catch {
      setVersions(null);
      setListError("Could not load draft versions.");
    } finally {
      setLoadingList(false);
    }
  }, [reportId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    if (!versions?.length) {
      setViewedVersionId(null);
      return;
    }
    setViewedVersionId((prev) => {
      if (prev != null && versions.some((v) => v.id === prev)) {
        return prev;
      }
      return pickWorkingVersion(versions)!.version.id;
    });
  }, [versions]);

  useEffect(() => {
    if (!viewedVersionId || listError) {
      return;
    }
    void loadDocument(viewedVersionId);
  }, [viewedVersionId, listError, loadDocument]);

  const handleCreateDraft = async () => {
    setCreating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/draft-versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Create draft failed (${res.status}).`);
        return;
      }
      const json = (await res.json()) as { version?: ReportDraftVersionDTO };
      await loadVersions();
      if (json.version?.id) {
        setViewedVersionId(json.version.id);
      }
    } catch {
      setActionError("Create draft failed.");
    } finally {
      setCreating(false);
    }
  };

  const handleBranchFrom = async (sourceVersionId: string) => {
    setBranchingId(sourceVersionId);
    setActionError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/draft-versions/${sourceVersionId}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Branch failed (${res.status}).`);
        return;
      }
      const json = (await res.json()) as { version?: ReportDraftVersionDTO };
      await loadVersions();
      if (json.version?.id) {
        setViewedVersionId(json.version.id);
      }
    } catch {
      setActionError("Branch failed.");
    } finally {
      setBranchingId(null);
    }
  };

  const handleActivateFrom = async (versionId: string) => {
    setActivatingId(versionId);
    setActionError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/draft-versions/${versionId}/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Set active failed (${res.status}).`);
        return;
      }
      await loadVersions();
      setViewedVersionId(versionId);
    } catch {
      setActionError("Set active failed.");
    } finally {
      setActivatingId(null);
    }
  };

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text || !viewedVersionId || !canEdit) {
      return;
    }
    setAddingNote(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/draft-versions/${viewedVersionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_key: "REPORT_NOTES",
          entity_kind: "manual_note",
          scope: "report",
          display_payload: {
            section_key: "REPORT_NOTES",
            display_text: text,
          },
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Could not add note (${res.status}).`);
        return;
      }
      setNoteText("");
      await loadDocument(viewedVersionId);
    } catch {
      setActionError("Could not add note.");
    } finally {
      setAddingNote(false);
    }
  };

  const handlePatchState = async (itemId: string, state: DraftItemState) => {
    if (!viewedVersionId || !canEdit) {
      return;
    }
    setPatchingItemId(itemId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/reports/${reportId}/draft-versions/${viewedVersionId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Update failed (${res.status}).`);
        return;
      }
      await loadDocument(viewedVersionId);
      await loadVersions();
    } catch {
      setActionError("Update failed.");
    } finally {
      setPatchingItemId(null);
    }
  };

  const handleSaveManualNote = useCallback(
    async (itemId: string, displayText: string) => {
      if (!viewedVersionId) return;
      setActionError(null);
      const res = await fetch(
        `/api/reports/${reportId}/draft-versions/${viewedVersionId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_text: displayText }),
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Could not save note (${res.status}).`);
        throw new Error(j.error ?? "Save failed");
      }
      await loadDocument(viewedVersionId);
    },
    [reportId, viewedVersionId, loadDocument]
  );

  const handleDeleteManualNote = useCallback(
    async (itemId: string) => {
      if (!viewedVersionId) return;
      setActionError(null);
      const res = await fetch(
        `/api/reports/${reportId}/draft-versions/${viewedVersionId}/items/${itemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Could not delete note (${res.status}).`);
        throw new Error(j.error ?? "Delete failed");
      }
      await loadDocument(viewedVersionId);
    },
    [reportId, viewedVersionId, loadDocument]
  );

  const workingCaption =
    viewedVersion == null
      ? null
      : isViewingActive
        ? `Editing the active draft (v${viewedVersion.version_number}). Line edits apply to this version only.`
        : viewedVersion.status === "finalized"
          ? `Viewing v${viewedVersion.version_number} (finalized, read-only).`
          : `Viewing v${viewedVersion.version_number} (${viewedVersion.status}). Read-only — activate this version or branch from it to edit.`;

  const captionTone: "default" | "amber" =
    viewedVersion && !isViewingActive && viewedVersion.status !== "finalized" ? "amber" : "default";

  const previewWorkflow =
    canEdit && !workflowReadOnlyFinalized
      ? {
          onPatchState: handlePatchState,
          pendingItemId: patchingItemId,
          readOnly: false,
        }
      : {
          onPatchState: async () => {},
          pendingItemId: null,
          readOnly: true,
        };

  const manualNoteActions =
    canEdit && !workflowReadOnlyFinalized && viewedVersionId
      ? {
          canEdit: true,
          onSave: handleSaveManualNote,
          onDelete: handleDeleteManualNote,
        }
      : undefined;

  if (loadingList && versions === null) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-workflow-heading">
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: cr.deepNavy, backgroundColor: `${cr.midnight}ee` }}
        >
          <h2
            id="draft-workflow-heading"
            className="font-serif text-sm font-normal tracking-wide uppercase mb-2"
            style={{ color: cr.gold, letterSpacing: "0.14em" }}
          >
            Report workspace
          </h2>
          <p className="text-sm font-sans" style={{ color: cr.slate }}>
            Loading draft…
          </p>
        </div>
      </section>
    );
  }

  if (listError && versions === null) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-workflow-heading">
        <p className="text-sm text-red-300/90" role="alert">
          {listError}
        </p>
      </section>
    );
  }

  if (versions !== null && versions.length === 0) {
    return (
      <section className="scroll-mt-10 space-y-3" aria-labelledby="draft-workflow-heading">
        <div
          className="rounded-xl border p-6 space-y-4"
          style={{ borderColor: cr.deepNavy, backgroundColor: `${cr.midnight}f2` }}
        >
          <h2
            id="draft-workflow-heading"
            className="font-serif text-lg font-normal"
            style={{ color: cr.chalk }}
          >
            Report workspace
          </h2>
          <p className="text-sm font-sans leading-relaxed" style={{ color: cr.slate }}>
            No draft yet. Create an initial draft from summary-prep candidates (same seed as before).
          </p>
          <button
            type="button"
            onClick={() => void handleCreateDraft()}
            disabled={creating}
            className="rounded-md px-4 py-2 text-sm font-sans font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: cr.steelBlue }}
          >
            {creating ? "Creating…" : "Create Draft"}
          </button>
          {actionError ? (
            <p className="text-sm text-red-300/90" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="scroll-mt-10 space-y-4" aria-labelledby="draft-workflow-heading">
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ borderColor: cr.deepNavy, backgroundColor: `${cr.midnight}f2` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="draft-workflow-heading"
              className="font-serif text-lg font-normal"
              style={{ color: cr.chalk }}
            >
              Report workspace
            </h2>
            <p className="text-[10px] font-sans uppercase tracking-widest mt-1" style={{ color: cr.gold }}>
              Durable draft
            </p>
          </div>
        </div>

        <div
          className="rounded-lg border p-3 space-y-2"
          style={{ borderColor: `${cr.deepNavy}`, backgroundColor: `${cr.deepNavy}44` }}
          aria-label="Draft versions"
        >
          <p
            className="text-[10px] font-sans font-semibold uppercase tracking-widest"
            style={{ color: cr.slate }}
          >
            Versions
          </p>
          <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {sortedVersions.map((v) => {
              const selected = v.id === viewedVersionId;
              const isActiveRow = v.status === "active";
              const showActivate =
                !isActiveRow && v.status !== "finalized" && v.status !== "archived";
              const showBranch = v.status !== "finalized";
              const parentNum = v.based_on_draft_version_id
                ? versionNumberById.get(v.based_on_draft_version_id)
                : undefined;

              let roleLine: string;
              if (selected) {
                if (isActiveRow && v.status !== "finalized") {
                  roleLine = "Shown below · active draft (editable)";
                } else if (v.status === "finalized") {
                  roleLine = "Shown below · read-only (finalized)";
                } else {
                  roleLine = "Shown below · read-only until activated or branched";
                }
              } else if (isActiveRow) {
                roleLine = "Active draft";
              } else {
                roleLine = "Not shown";
              }

              return (
                <li key={v.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewedVersionId(v.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setViewedVersionId(v.id);
                      }
                    }}
                    className="rounded-md border px-2.5 py-2 text-left cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1B2E] focus-visible:ring-[#0D4F8C]/80"
                    style={{
                      borderColor: selected ? `${cr.steelBlue}99` : cr.deepNavy,
                      backgroundColor: selected ? `${cr.midnight}ee` : `${cr.midnight}99`,
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-serif text-sm tabular-nums" style={{ color: cr.chalk }}>
                            v{v.version_number}
                          </span>
                          <span
                            className="text-[10px] font-sans font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{
                              color: isActiveRow ? cr.chalk : cr.slate,
                              backgroundColor: isActiveRow ? `${cr.steelBlue}44` : `${cr.deepNavy}cc`,
                              border: `1px solid ${cr.deepNavy}`,
                            }}
                          >
                            {statusBadgeLabel(v.status)}
                          </span>
                        </div>
                        <p className="text-[10px] font-sans leading-snug" style={{ color: cr.slate }}>
                          {roleLine}
                        </p>
                        {parentNum != null ? (
                          <p className="text-[10px] font-sans italic" style={{ color: `${cr.chalk}cc` }}>
                            Branched from v{parentNum}
                          </p>
                        ) : null}
                        <p className="text-[10px] font-sans mt-0.5" style={{ color: `${cr.slate}dd` }}>
                          Created {formatVersionTimestamp(v.created_at)} · Updated{" "}
                          {formatVersionTimestamp(v.updated_at)}
                        </p>
                        {(v.review_needed_count ?? 0) > 0 || (v.warning_count ?? 0) > 0 ? (
                          <p className="text-[10px] font-sans mt-0.5" style={{ color: `${cr.slate}cc` }}>
                            {(v.review_needed_count ?? 0) > 0
                              ? `${v.review_needed_count} need review`
                              : null}
                            {(v.review_needed_count ?? 0) > 0 && (v.warning_count ?? 0) > 0 ? " · " : null}
                            {(v.warning_count ?? 0) > 0
                              ? `${v.warning_count} warning${(v.warning_count ?? 0) === 1 ? "" : "s"}`
                              : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                        {v.status === "stale" ? (
                          <button
                            type="button"
                            disabled={loadingDocument}
                            onClick={(e) => {
                              e.stopPropagation();
                              scrollToReviewPanel();
                            }}
                            className="rounded px-2 py-1 text-[10px] font-sans font-medium disabled:opacity-50"
                            style={{
                              borderWidth: 1,
                              borderStyle: "solid",
                              borderColor: `${cr.gold}88`,
                              color: cr.gold,
                              backgroundColor: `${cr.deepNavy}cc`,
                            }}
                          >
                            Review
                          </button>
                        ) : null}
                        {showActivate ? (
                          <button
                            type="button"
                            disabled={activatingId === v.id || loadingDocument}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleActivateFrom(v.id);
                            }}
                            className="rounded px-2 py-1 text-[10px] font-sans font-medium text-white disabled:opacity-50"
                            style={{ backgroundColor: cr.steelBlue }}
                          >
                            {activatingId === v.id ? "…" : "Activate"}
                          </button>
                        ) : null}
                        {showBranch ? (
                          <button
                            type="button"
                            disabled={branchingId === v.id || loadingDocument}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleBranchFrom(v.id);
                            }}
                            className="rounded border px-2 py-1 text-[10px] font-sans font-medium disabled:opacity-50"
                            style={{
                              borderColor: cr.steelBlue,
                              color: cr.chalk,
                              backgroundColor: `${cr.deepNavy}99`,
                            }}
                          >
                            {branchingId === v.id ? "…" : "Branch"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {actionError ? (
          <p
            className="text-sm rounded-md border px-3 py-2 font-sans"
            style={{
              borderColor: "rgba(220, 80, 80, 0.35)",
              backgroundColor: "rgba(60, 20, 20, 0.35)",
              color: "#fecaca",
            }}
            role="alert"
          >
            {actionError}
          </p>
        ) : null}

        {!canEdit && viewedVersion && !workflowReadOnlyFinalized ? (
          <div
            className="rounded-md border px-3 py-2.5 text-sm font-sans"
            style={{
              borderColor: `${cr.gold}55`,
              backgroundColor: `${cr.deepNavy}80`,
              color: cr.chalk,
            }}
            role="status"
          >
            This version is not the active draft. Editing is disabled. Use{" "}
            <strong className="font-semibold">Activate</strong> to make it editable, or{" "}
            <strong className="font-semibold">Branch</strong> to copy it into a new active draft.
          </div>
        ) : null}

        {workflowReadOnlyFinalized ? (
          <p className="text-sm font-sans" style={{ color: cr.slate }}>
            This draft version is finalized and cannot be edited.
          </p>
        ) : null}

        <div
          className="rounded-lg border p-4 space-y-2"
          style={{ borderColor: `${cr.deepNavy}`, backgroundColor: `${cr.deepNavy}55` }}
        >
          <p className="text-[10px] font-sans font-semibold uppercase tracking-widest" style={{ color: cr.slate }}>
            Report notes
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 block">
              <span className="sr-only">Manual note</span>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                disabled={!canEdit || workflowReadOnlyFinalized || loadingDocument || !viewedVersionId}
                placeholder={
                  canEdit ? "Add a report-level note…" : "Activate the draft you need to add notes."
                }
                className="w-full rounded-md border px-3 py-2 text-sm font-sans disabled:opacity-50"
                style={{
                  borderColor: cr.deepNavy,
                  backgroundColor: cr.midnight,
                  color: cr.chalk,
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleAddNote()}
              disabled={
                !canEdit ||
                workflowReadOnlyFinalized ||
                addingNote ||
                loadingDocument ||
                !viewedVersionId ||
                noteText.trim().length === 0
              }
              className="rounded-md px-3 py-2 text-sm font-sans font-medium text-white disabled:opacity-50 shrink-0"
              style={{ backgroundColor: canEdit ? cr.steelBlue : `${cr.slate}99` }}
            >
              {addingNote ? "Adding…" : "Add note"}
            </button>
          </div>
        </div>
      </div>

      <div
        id={REVIEW_PANEL_ID}
        className="scroll-mt-10 rounded-lg border p-4 space-y-3"
        style={{ borderColor: cr.deepNavy, backgroundColor: `${cr.midnight}ee` }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-serif text-base font-normal" style={{ color: cr.chalk }}>
            Review required
          </h3>
          <span className="text-xs font-medium tabular-nums font-sans" style={{ color: cr.gold }}>
            {reviewEntries.length === 0 ? "Clear" : `${reviewEntries.length} open`}
          </span>
        </div>
        {reviewEntries.length === 0 ? (
          <p className="text-sm font-sans" style={{ color: cr.slate }}>
            Nothing is waiting for a decision in this version&apos;s assembled document.
          </p>
        ) : (
          <div className="space-y-4">
            {(
              [
                ["extraction_warning", "Extraction & system notices"],
                ["review_needed_fact", "Facts requiring a decision"],
              ] as const
            ).map(([group, label]) => {
              const rows = reviewEntries.filter((e) => e.group === group);
              if (rows.length === 0) return null;
              return (
                <div key={group}>
                  <p
                    className="text-[10px] font-sans uppercase tracking-widest mb-2"
                    style={{ color: cr.slate }}
                  >
                    {label}
                  </p>
                  <ul className="space-y-2">
                    {rows.map((e) => {
                      const text =
                        typeof e.block.displayPayload.display_text === "string"
                          ? e.block.displayPayload.display_text
                          : "";
                      return (
                        <li
                          key={e.block.draftItemId}
                          className="rounded-md border px-3 py-2.5 font-sans"
                          style={{ borderColor: cr.deepNavy, backgroundColor: `${cr.deepNavy}55` }}
                        >
                          <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: cr.slate }}>
                            {e.pathLabel}
                          </p>
                          <p className="text-sm whitespace-pre-wrap wrap-break-word" style={{ color: cr.chalk }}>
                            {text}
                          </p>
                          <p className="text-xs mt-1" style={{ color: cr.slate }}>
                            State:{" "}
                            <span style={{ color: cr.gold }}>{e.block.state}</span>
                          </p>
                          {canEdit && !workflowReadOnlyFinalized ? (
                            <div
                              className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t font-sans"
                              style={{ borderColor: cr.deepNavy }}
                            >
                              <button
                                type="button"
                                disabled={patchingItemId === e.block.draftItemId}
                                onClick={() => void handlePatchState(e.block.draftItemId, "included")}
                                className="rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
                                style={{
                                  borderWidth: 1,
                                  borderStyle: "solid",
                                  borderColor: `${cr.steelBlue}88`,
                                  color: cr.chalk,
                                }}
                              >
                                Include
                              </button>
                              <button
                                type="button"
                                disabled={patchingItemId === e.block.draftItemId}
                                onClick={() => void handlePatchState(e.block.draftItemId, "excluded")}
                                className="rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
                                style={{
                                  borderWidth: 1,
                                  borderStyle: "solid",
                                  borderColor: `${cr.steelBlue}88`,
                                  color: cr.chalk,
                                }}
                              >
                                Exclude
                              </button>
                              <button
                                type="button"
                                disabled={patchingItemId === e.block.draftItemId}
                                onClick={() => void handlePatchState(e.block.draftItemId, "review_needed")}
                                className="rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
                                style={{
                                  borderWidth: 1,
                                  borderStyle: "solid",
                                  borderColor: `${cr.steelBlue}88`,
                                  color: cr.chalk,
                                }}
                              >
                                Keep as review needed
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs mt-2" style={{ color: `${cr.slate}cc` }}>
                              Activate this version to edit items from the queue or inline preview.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loadingDocument && !document && !documentLoadError ? (
        <p className="text-sm font-sans pl-1" style={{ color: cr.slate }}>
          Loading draft document…
        </p>
      ) : (
        <DraftDocumentPreview
          document={document}
          error={documentLoadError}
          actionError={null}
          caption={workingCaption}
          captionTone={captionTone}
          workflow={previewWorkflow}
          manualNoteActions={manualNoteActions}
          jumpToReviewQueue={
            document?.status === "stale" && reviewEntries.length > 0
              ? { count: reviewEntries.length, onJump: scrollToReviewPanel }
              : undefined
          }
        />
      )}
    </section>
  );
}
