"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DraftDocumentPreview } from "@/components/reports/draft-document-preview";
import type { DraftItemState, ReportDraftVersionDTO } from "@/types/draft";
import type { DraftDocument } from "@/types/draft-document";

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

export function ReportDraftWorkflow({ reportId }: ReportDraftWorkflowProps) {
  const [versions, setVersions] = useState<ReportDraftVersionDTO[] | null>(null);
  const [document, setDocument] = useState<DraftDocument | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [creating, setCreating] = useState(false);
  const [branching, setBranching] = useState(false);
  const [activating, setActivating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [patchingItemId, setPatchingItemId] = useState<string | null>(null);

  const working = useMemo(
    () => (versions ? pickWorkingVersion(versions) : null),
    [versions]
  );

  const canEdit = working?.isOfficialActive === true;

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

  const handleBranch = async () => {
    if (!working) {
      return;
    }
    setBranching(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/reports/${reportId}/draft-versions/${working.version.id}/branch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Branch failed (${res.status}).`);
        return;
      }
      await loadVersions();
    } catch {
      setActionError("Branch failed.");
    } finally {
      setBranching(false);
    }
  };

  const handleActivate = async () => {
    if (!working) {
      return;
    }
    setActivating(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/reports/${reportId}/draft-versions/${working.version.id}/activate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(j.error ?? `Set active failed (${res.status}).`);
        return;
      }
      await loadVersions();
    } catch {
      setActionError("Set active failed.");
    } finally {
      setActivating(false);
    }
  };

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text || !working || !canEdit) {
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
    if (!working || !canEdit) {
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
        ? "Working copy: the active draft for this report (edits apply here only)."
        : `Viewing latest saved draft v${working.version.version_number} (${working.version.status}). Read-only — branch or set active to edit.`;

  const captionTone = working && !working.isOfficialActive ? "amber" : "default";

  const workflowReadOnlyFinalized = working != null && working.version.status === "finalized";

  const showBranch =
    versions != null && versions.length > 0 && working != null && working.version.status !== "finalized";
  const showActivate =
    working != null &&
    !working.isOfficialActive &&
    working.version.status !== "finalized" &&
    working.version.status !== "archived";

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
          <div className="flex flex-wrap gap-2 justify-end">
            {showBranch ? (
              <button
                type="button"
                onClick={() => void handleBranch()}
                disabled={branching || loadingDocument}
                className="rounded-md border px-3 py-2 text-xs font-sans font-medium disabled:opacity-50"
                style={{
                  borderColor: cr.steelBlue,
                  color: cr.chalk,
                  backgroundColor: `${cr.deepNavy}99`,
                }}
              >
                {branching ? "Branching…" : "Branch Draft"}
              </button>
            ) : null}
            {showActivate ? (
              <button
                type="button"
                onClick={() => void handleActivate()}
                disabled={activating || loadingDocument}
                className="rounded-md px-3 py-2 text-xs font-sans font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: cr.steelBlue }}
              >
                {activating ? "Setting…" : "Set Active"}
              </button>
            ) : null}
          </div>
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

        {!canEdit && working && !workflowReadOnlyFinalized ? (
          <div
            className="rounded-md border px-3 py-2.5 text-sm font-sans"
            style={{
              borderColor: `${cr.gold}66`,
              backgroundColor: `${cr.deepNavy}80`,
              color: cr.chalk,
            }}
            role="status"
          >
            This draft is not active. Editing is disabled. Use <strong className="font-semibold">Branch Draft</strong>{" "}
            to copy it into a new editable draft, or <strong className="font-semibold">Set Active</strong> to make this
            version the one editable draft.
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
                disabled={!canEdit || workflowReadOnlyFinalized || loadingDocument || !working}
                placeholder={
                  canEdit ? "Add a report-level note…" : "Activate or branch a draft to add notes."
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
                !working ||
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
          workflow={
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
                }
          }
        />
      )}
    </section>
  );
}
