"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentUpload } from "@/components/extraction/document-upload";
import { ReportSourcesList } from "@/components/reports/report-sources-list";
import { REPORT_TEMPLATE_CONFIGS } from "@/lib/config/report-templates";
import {
  ReportStatus,
  ReportType,
  type Report,
  type ReportSource,
} from "@/types";
import { cn } from "@/lib/utils";

interface ReportEditFormProps {
  initialReport: Report;
}

export function ReportEditForm({ initialReport }: ReportEditFormProps) {
  const router = useRouter();
  const [report, setReport] = useState<Report>(initialReport);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const supportsUpload = useMemo(
    () => REPORT_TEMPLATE_CONFIGS[report.report_type].supportsDocumentUpload,
    [report.report_type]
  );

  function updateField<K extends keyof Report>(key: K, value: Report[K]) {
    setReport((r) => ({ ...r, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: report.status,
          report_type: report.report_type,
          case_name: report.case_name,
          client_name: report.client_name,
          investigator_name: report.investigator_name,
          subject_name: report.subject_name,
          report_date: report.report_date,
          summary_notes: report.summary_notes,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | Report
        | { error?: string }
        | null;

      if (!res.ok) {
        const err =
          json && typeof json === "object" && "error" in json
            ? json.error
            : undefined;
        setMessage({
          type: "err",
          text: err ?? `Save failed (${res.status})`,
        });
        return;
      }

      if (!json || typeof json !== "object" || !("id" in json)) {
        setMessage({ type: "err", text: "Invalid response from server." });
        return;
      }

      setMessage({ type: "ok", text: "Saved." });
      setReport(json as Report);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Network error while saving." });
    } finally {
      setSaving(false);
    }
  }

  function onSourceUploaded(incoming: ReportSource) {
    setReport((r) => ({
      ...r,
      sources: [incoming, ...(r.sources ?? [])],
    }));
  }

  return (
    <div className="space-y-8">
      {message ? (
        <div
          role="status"
          className={cn(
            "rounded-md px-4 py-3 text-sm",
            message.type === "ok"
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              : "bg-red-500/10 text-red-300 border border-red-500/20"
          )}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Report type">
          <select
            value={report.report_type}
            onChange={(e) =>
              updateField("report_type", e.target.value as ReportType)
            }
            className="w-full rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0]"
          >
            <option value={ReportType.BACKGROUND_INVESTIGATION}>
              Background Investigation
            </option>
            <option value={ReportType.SURVEILLANCE}>Surveillance</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            value={report.status}
            onChange={(e) =>
              updateField("status", e.target.value as ReportStatus)
            }
            className="w-full rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0]"
          >
            <option value={ReportStatus.DRAFT}>Draft</option>
            <option value={ReportStatus.FINAL}>Final</option>
            <option value={ReportStatus.ARCHIVED}>Archived</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Case name">
          <input
            value={report.case_name}
            onChange={(e) => updateField("case_name", e.target.value)}
            className="w-full rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0]"
          />
        </Field>
        <Field label="Client name">
          <input
            value={report.client_name}
            onChange={(e) => updateField("client_name", e.target.value)}
            className="w-full rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0]"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Investigator name">
          <input
            value={report.investigator_name}
            onChange={(e) => updateField("investigator_name", e.target.value)}
            className="w-full rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0]"
          />
        </Field>
        <Field label="Subject name">
          <input
            value={report.subject_name}
            onChange={(e) => updateField("subject_name", e.target.value)}
            className="w-full rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0]"
          />
        </Field>
      </div>

      <Field label="Report date">
        <input
          type="date"
          value={report.report_date ?? ""}
          onChange={(e) =>
            updateField(
              "report_date",
              e.target.value === "" ? null : e.target.value
            )
          }
          className="w-full max-w-xs rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0]"
        />
      </Field>

      <Field label="Summary notes">
        <textarea
          value={report.summary_notes ?? ""}
          onChange={(e) =>
            updateField(
              "summary_notes",
              e.target.value === "" ? null : e.target.value
            )
          }
          rows={5}
          className="w-full rounded-md border border-[#2a2f42] bg-[#0f1117] px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#8b90a0]"
          placeholder="Investigator notes and summary…"
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-[#4f7ef5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3d6de0] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {supportsUpload ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#8b90a0] uppercase tracking-wide">
            Source documents
          </p>
          <DocumentUpload
            reportId={report.id}
            onUploaded={onSourceUploaded}
            onRefresh={() => router.refresh()}
          />
          <ReportSourcesList sources={report.sources ?? []} />
        </div>
      ) : (
        <div className="rounded-lg border border-[#2a2f42] bg-[#161922] px-4 py-3 text-sm text-[#8b90a0]">
          This report type does not use document upload in this workflow.
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#8b90a0]">{label}</label>
      {children}
    </div>
  );
}
