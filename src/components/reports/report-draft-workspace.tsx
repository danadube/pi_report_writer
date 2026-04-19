"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { collectDraftReviewPanelEntries } from "@/lib/drafts/collect-draft-review-entries";
import type { DraftDocument } from "@/types/draft-document";
import type { DraftItemState } from "@/types/draft";
import type { ReportDraftVersionWithCounts } from "@/types/draft";
import { DraftDocumentPreview } from "@/components/reports/draft-document-preview";

const REVIEW_PANEL_ID = "review-required-panel";

function pickPrimaryVersionId(versions: ReportDraftVersionWithCounts[]): string | null {
  const primary =
    versions.find((v) => v.status === "active") ?? versions.find((v) => v.status === "stale");
  return primary?.id ?? versions[0]?.id ?? null;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "border-[#1e3050] text-[#b8c5d9]";
    case "stale":
      return "border-[#C8901A]/60 text-[#C8901A]";
    case "draft":
      return "border-[#3d4a66] text-[#8b90a0]";
    default:
      return "border-[#3d4a66] text-[#8b90a0]";
  }
}

export function ReportDraftWorkspace({ reportId }: { reportId: string }) {
  const [versions, setVersions] = useState<ReportDraftVersionWithCounts[]>([]);
  const [viewedVersionId, setViewedVersionId] = useState<string | null>(null);
  const [draftDocument, setDraftDocument] = useState<DraftDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [versionAction, setVersionAction] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/reports/${reportId}/draft-versions`, { cache: "no-store" });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Could not load draft versions (${res.status}).`);
    }
    const json = (await res.json()) as { versions?: ReportDraftVersionWithCounts[] };
    const v = json.versions ?? [];
    setVersions(v);
    return v;
  }, [reportId]);

  const loadDocument = useCallback(
    async (versionId: string) => {
      const res = await fetch(`/api/reports/${reportId}/draft-versions/${versionId}/document`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setDocError(err.error ?? `Could not load draft document (${res.status}).`);
        setDraftDocument(null);
        return;
      }
      setDocError(null);
      setDraftDocument((await res.json()) as DraftDocument);
    },
    [reportId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const v = await loadVersions();
        if (cancelled) return;
        const primary = pickPrimaryVersionId(v);
        setViewedVersionId((prev) => {
          if (prev && v.some((x) => x.id === prev)) return prev;
          return primary;
        });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load drafts.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadVersions, reportId]);

  useEffect(() => {
    if (!viewedVersionId) return;
    void loadDocument(viewedVersionId);
  }, [viewedVersionId, loadDocument]);

  const viewedVersion = versions.find((v) => v.id === viewedVersionId) ?? null;

  const canEdit = Boolean(
    viewedVersion && (viewedVersion.status === "active" || viewedVersion.status === "stale")
  );

  const reviewEntries = useMemo(() => collectDraftReviewPanelEntries(draftDocument), [draftDocument]);

  const onPatchItem = useCallback(
    async (itemId: string, state: DraftItemState) => {
      if (!viewedVersionId || !canEdit) return;
      setPatchingId(itemId);
      setDocError(null);
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
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Update failed (${res.status}).`);
        }
        await loadDocument(viewedVersionId);
        await loadVersions();
      } catch (e) {
        setDocError(e instanceof Error ? e.message : "Update failed.");
      } finally {
        setPatchingId(null);
      }
    },
    [reportId, viewedVersionId, canEdit, loadDocument, loadVersions]
  );

  const scrollToReviewPanel = useCallback(() => {
    globalThis.document.getElementById(REVIEW_PANEL_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const runActivate = async (versionId: string) => {
    setVersionAction(`activate:${versionId}`);
    try {
      const res = await fetch(`/api/reports/${reportId}/draft-versions/${versionId}/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Activate failed (${res.status}).`);
      }
      const v = await loadVersions();
      const primary = pickPrimaryVersionId(v);
      if (primary) setViewedVersionId(primary);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Activate failed.");
    } finally {
      setVersionAction(null);
    }
  };

  const runBranch = async (versionId: string) => {
    setVersionAction(`branch:${versionId}`);
    try {
      const res = await fetch(`/api/reports/${reportId}/draft-versions/${versionId}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Branch failed (${res.status}).`);
      }
      const json = (await res.json()) as { version?: { id: string } };
      await loadVersions();
      if (json.version?.id) {
        setViewedVersionId(json.version.id);
      }
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Branch failed.");
    } finally {
      setVersionAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#8b90a0] py-8">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading draft workspace…
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-red-300/90" role="alert">
        {loadError}
      </p>
    );
  }

  if (versions.length === 0) {
    return (
      <section className="scroll-mt-10 space-y-2">
        <h2 className="font-serif text-lg text-[#e8eaf0] tracking-tight">Durable draft</h2>
        <p className="text-sm text-[#8b90a0]">
          No draft versions yet. Seed a draft from summary prep to begin.
        </p>
      </section>
    );
  }

  const previewError = docError;

  return (
    <section className="scroll-mt-10 space-y-6">
      <header className="space-y-1">
        <h2 className="font-serif text-lg text-[#e8eaf0] tracking-tight">Durable draft</h2>
        <p className="text-sm text-[#8b90a0]">
          Server-assembled draft document. Summary checkboxes above are separate from this durable draft.
        </p>
      </header>

      <div className="rounded-lg border border-[#1e3050] bg-[#0c1018] p-4">
        <h3 className="font-serif text-base text-[#e8eaf0] mb-3">Versions</h3>
        <ul className="space-y-2">
          {versions.map((v) => {
            const isView = v.id === viewedVersionId;
            const busy =
              versionAction === `activate:${v.id}` || versionAction === `branch:${v.id}`;
            const needsLine =
              v.review_needed_count > 0
                ? `${v.review_needed_count} item${v.review_needed_count === 1 ? "" : "s"} need review`
                : null;
            const warnLine =
              v.warning_count > 0
                ? `${v.warning_count} warning${v.warning_count === 1 ? "" : "s"}`
                : null;
            const summaryParts = [needsLine, warnLine].filter(Boolean);
            const canActivate = v.status === "draft";
            const canBranch = v.status !== "finalized" && v.status !== "archived";
            return (
              <li
                key={v.id}
                className={`rounded-md border px-3 py-2.5 transition-colors ${
                  isView
                    ? "border-[#C8901A]/50 bg-[#0f141c]"
                    : "border-[#243552] bg-[#0a0e14] hover:border-[#2f4a6e]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewedVersionId(v.id)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[#e8eaf0] tabular-nums">
                        v{v.version_number}
                      </span>
                      {v.title ? (
                        <span className="text-xs text-[#8b90a0] truncate max-w-[12rem]">{v.title}</span>
                      ) : null}
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusBadgeClass(v.status)}`}
                      >
                        {v.status}
                      </span>
                    </div>
                    {summaryParts.length > 0 ? (
                      <p className="text-xs text-[#8b90a0] mt-1">
                        {summaryParts.join(" · ")}
                      </p>
                    ) : (
                      <p className="text-xs text-[#5a6070] mt-1">No review queue</p>
                    )}
                  </button>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    {v.status === "stale" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => scrollToReviewPanel()}
                        className="text-xs px-2 py-1 rounded border border-[#C8901A]/50 text-[#C8901A] hover:bg-[#C8901A]/10 disabled:opacity-50"
                      >
                        Review
                      </button>
                    ) : null}
                    {canActivate ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runActivate(v.id)}
                        className="text-xs px-2 py-1 rounded border border-[#2f4a6e] text-[#b8c5d9] hover:bg-[#1a2438] disabled:opacity-50"
                      >
                        Activate
                      </button>
                    ) : null}
                    {canBranch ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void runBranch(v.id)}
                        className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2f4a6e] text-[#b8c5d9] hover:bg-[#1a2438] disabled:opacity-50"
                      >
                        <GitBranch className="h-3 w-3" aria-hidden />
                        Branch
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        id={REVIEW_PANEL_ID}
        className="scroll-mt-10 rounded-lg border border-[#1e3050] bg-[#0c1018] p-4 shadow-[inset_0_1px_0_0_rgba(200,144,26,0.08)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="font-serif text-base text-[#e8eaf0]">Review required</h3>
          <span className="text-xs font-medium tabular-nums text-[#C8901A]">
            {reviewEntries.length === 0 ? "Clear" : `${reviewEntries.length} open`}
          </span>
        </div>
        {reviewEntries.length === 0 ? (
          <p className="text-sm text-[#8b90a0]">
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
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#6b7484] mb-2 font-sans">
                    {label}
                  </p>
                  <ul className="space-y-2">
                    {rows.map((e) => {
                      const text =
                        typeof e.block.displayPayload.display_text === "string"
                          ? e.block.displayPayload.display_text
                          : "";
                      const st = e.block.state;
                      return (
                        <li
                          key={e.block.draftItemId}
                          className="rounded-md border border-[#243552] bg-[#0a0e14] p-3"
                        >
                          <p className="text-[10px] uppercase tracking-wide text-[#6b7484] mb-1 font-sans">
                            {e.pathLabel}
                          </p>
                          <p className="text-sm text-[#e8eaf0] whitespace-pre-wrap wrap-break-word font-sans">
                            {text}
                          </p>
                          <p className="text-xs text-[#8b90a0] mt-1 font-sans">
                            State: <span className="text-[#C8901A]">{st}</span>
                          </p>
                          {canEdit ? (
                            <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-[#243552] font-sans">
                              <button
                                type="button"
                                disabled={patchingId === e.block.draftItemId}
                                onClick={() => void onPatchItem(e.block.draftItemId, "included")}
                                className="text-xs px-2 py-1 rounded border border-[#2f4a6e] text-[#b8c5d9] hover:bg-[#1a2438] disabled:opacity-50"
                              >
                                Include
                              </button>
                              <button
                                type="button"
                                disabled={patchingId === e.block.draftItemId}
                                onClick={() => void onPatchItem(e.block.draftItemId, "excluded")}
                                className="text-xs px-2 py-1 rounded border border-[#2f4a6e] text-[#b8c5d9] hover:bg-[#1a2438] disabled:opacity-50"
                              >
                                Exclude
                              </button>
                              <button
                                type="button"
                                disabled={patchingId === e.block.draftItemId}
                                onClick={() => void onPatchItem(e.block.draftItemId, "review_needed")}
                                className="text-xs px-2 py-1 rounded border border-[#2f4a6e] text-[#b8c5d9] hover:bg-[#1a2438] disabled:opacity-50"
                              >
                                Keep as review needed
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-[#6b7080] mt-2 font-sans">
                              Activate this version to edit items, or view an active or stale draft.
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

      <DraftDocumentPreview
        document={draftDocument}
        error={previewError}
        noActiveDraft={false}
        canEdit={canEdit}
        onPatchItem={onPatchItem}
        patchingItemId={patchingId}
        reviewEntryCount={reviewEntries.length}
        reviewPanelAnchor={`#${REVIEW_PANEL_ID}`}
      />
    </section>
  );
}
