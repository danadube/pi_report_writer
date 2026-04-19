"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DraftDocumentPreview } from "@/components/reports/draft-document-preview";
import type { DraftItemState, ReportDraftVersionDTO } from "@/types/draft";
import type { DraftDocument } from "@/types/draft-document";

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

export function ReportDraftWorkflow({ reportId }: ReportDraftWorkflowProps) {
  const [versions, setVersions] = useState<ReportDraftVersionDTO[] | null>(null);
  const [document, setDocument] = useState<DraftDocument | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [creating, setCreating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [patchingItemId, setPatchingItemId] = useState<string | null>(null);

  const working = useMemo(
    () => (versions ? pickWorkingVersion(versions) : null),
    [versions]
  );

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
    if (versions === null || listError) {
      return;
    }
    const picked = pickWorkingVersion(versions);
    if (!picked) {
      setDocument(null);
      setDocumentLoadError(null);
      return;
    }
    void loadDocument(picked.version.id);
  }, [versions, listError, loadDocument]);

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
      await loadVersions();
    } catch {
      setActionError("Create draft failed.");
    } finally {
      setCreating(false);
    }
  };

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text || !working) {
      return;
    }
    setAddingNote(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/reports/${reportId}/draft-versions/${working.version.id}/items`,
        {
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
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Could not add note (${res.status}).`);
        return;
      }
      setNoteText("");
      await loadDocument(working.version.id);
    } catch {
      setActionError("Could not add note.");
    } finally {
      setAddingNote(false);
    }
  };

  const handlePatchState = async (itemId: string, state: DraftItemState) => {
    if (!working) {
      return;
    }
    setPatchingItemId(itemId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/reports/${reportId}/draft-versions/${working.version.id}/items/${itemId}`,
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
      await loadDocument(working.version.id);
    } catch {
      setActionError("Update failed.");
    } finally {
      setPatchingItemId(null);
    }
  };

  const workingCaption =
    working == null
      ? null
      : working.isOfficialActive
        ? "Working draft for this page: the active draft (same as server status below)."
        : `Working draft for this page: latest saved version v${working.version.version_number} (status “${working.version.status}”). Not the active draft — display only; nothing was promoted.`;

  const captionTone = working && !working.isOfficialActive ? "amber" : "default";

  const workflowReadOnly = working != null && working.version.status === "finalized";

  if (loadingList && versions === null) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-workflow-heading">
        <h2
          id="draft-workflow-heading"
          className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2"
        >
          Draft
        </h2>
        <p className="text-sm text-[#8b90a0]">Loading draft…</p>
      </section>
    );
  }

  if (listError && versions === null) {
    return (
      <section className="scroll-mt-10" aria-labelledby="draft-workflow-heading">
        <h2
          id="draft-workflow-heading"
          className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide mb-2"
        >
          Draft
        </h2>
        <p className="text-sm text-red-300/90" role="alert">
          {listError}
        </p>
      </section>
    );
  }

  if (versions !== null && versions.length === 0) {
    return (
      <section className="scroll-mt-10 space-y-3" aria-labelledby="draft-workflow-heading">
        <h2
          id="draft-workflow-heading"
          className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide"
        >
          Draft
        </h2>
        <p className="text-sm text-[#8b90a0]">No draft yet. Create one from the current summary-prep seed.</p>
        <button
          type="button"
          onClick={() => void handleCreateDraft()}
          disabled={creating}
          className="rounded-md bg-[#4f7ef5] px-3 py-2 text-sm font-medium text-white hover:bg-[#3d6de0] disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create Draft"}
        </button>
        {actionError ? (
          <p className="text-sm text-red-300/90" role="alert">
            {actionError}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="scroll-mt-10 space-y-4" aria-labelledby="draft-workflow-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="draft-workflow-heading" className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
          Draft
        </h2>
        <button
          type="button"
          onClick={() => void handleCreateDraft()}
          disabled={creating}
          className="rounded-md border border-[#2a2f42] px-2.5 py-1.5 text-xs text-[#8b90a0] hover:bg-[#1e2130] disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create Draft"}
        </button>
      </div>

      {actionError ? (
        <p className="text-sm text-red-300/90 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="rounded-lg border border-[#2a2f42] bg-[#161922] p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7080]">Report notes (manual)</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 block">
            <span className="sr-only">Manual note</span>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              disabled={workflowReadOnly || loadingDocument || !working}
              placeholder="Add a report-level note…"
              className="w-full rounded-md border border-[#2a2f42] bg-[#12141c] px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#5a6070] disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleAddNote()}
            disabled={
              workflowReadOnly ||
              addingNote ||
              loadingDocument ||
              !working ||
              noteText.trim().length === 0
            }
            className="rounded-md bg-[#3d4a66] px-3 py-2 text-sm text-white hover:bg-[#4d5b7a] disabled:opacity-50 shrink-0"
          >
            {addingNote ? "Adding…" : "Add note"}
          </button>
        </div>
      </div>

      {loadingDocument && !document && !documentLoadError ? (
        <p className="text-sm text-[#8b90a0]">Loading draft document…</p>
      ) : (
        <DraftDocumentPreview
          document={document}
          error={documentLoadError}
          actionError={null}
          caption={workingCaption}
          captionTone={captionTone}
          workflow={{
            onPatchState: handlePatchState,
            pendingItemId: patchingItemId,
            readOnly: workflowReadOnly,
          }}
        />
      )}
    </section>
  );
}
