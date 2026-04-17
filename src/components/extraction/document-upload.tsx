"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportSource } from "@/types";

interface DocumentUploadProps {
  reportId: string;
  /** Called when the file is stored and report_sources row exists */
  onUploaded?: (source: ReportSource) => void;
  /** Optional: e.g. router.refresh() to sync server components */
  onRefresh?: () => void;
  accept?: string;
}

const MAX_FILE_SIZE_MB = 20;
const ACCEPTED_TYPES = ["application/pdf"];

type Phase = "idle" | "uploading" | "success" | "error";

/**
 * PDF upload to POST /api/uploads with multipart form (file + reportId).
 *
 * TODO: Reconnect extraction pipeline when extraction milestone lands.
 */
export function DocumentUpload({
  reportId,
  onUploaded,
  onRefresh,
  accept = ".pdf",
}: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function performUpload(file: File) {
    setPhase("uploading");
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("reportId", reportId);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        source?: ReportSource;
      };

      if (!res.ok) {
        setPhase("error");
        setUploadError(data.error ?? `Upload failed (${res.status})`);
        return;
      }

      if (data.source) {
        onUploaded?.(data.source);
      }

      setPhase("success");
      onRefresh?.();

      window.setTimeout(() => {
        setPhase("idle");
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }, 2000);
    } catch {
      setPhase("error");
      setUploadError("Network error during upload.");
    }
  }

  function validateAndSelect(file: File) {
    setValidationError(null);
    setUploadError(null);
    setPhase("idle");

    if (!ACCEPTED_TYPES.includes(file.type) && file.type !== "") {
      setValidationError("Only PDF files are supported.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setValidationError("Only PDF files are supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setValidationError(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setSelectedFile(file);
    void performUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  }

  function clearFile() {
    setSelectedFile(null);
    setValidationError(null);
    setUploadError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  const isBusy = phase === "uploading";

  return (
    <div className="space-y-2">
      {selectedFile ? (
        <div className="flex items-center justify-between rounded-lg border border-[#2a2f42] bg-[#161922] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="text-[#4f7ef5] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-[#e8eaf0] font-medium truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[#8b90a0]">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {phase === "uploading" && (
              <span className="text-xs text-[#4f7ef5] animate-pulse">
                Uploading…
              </span>
            )}
            {phase === "success" && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={14} />
                Uploaded
              </span>
            )}
            {phase === "error" && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={14} />
                Failed
              </span>
            )}
            {!isBusy && phase !== "success" && (
              <button
                type="button"
                onClick={clearFile}
                className="text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
                aria-label="Clear file"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isBusy && inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors",
            isBusy
              ? "border-[#2a2f42] opacity-60 cursor-wait"
              : "cursor-pointer",
            dragOver
              ? "border-[#4f7ef5] bg-[#1e2a4a]"
              : "border-[#2a2f42] bg-[#161922] hover:border-[#4f7ef5]/50"
          )}
        >
          <UploadCloud size={28} className="text-[#8b90a0] mb-2" />
          <p className="text-sm text-[#e8eaf0] font-medium">
            Drop a PDF here or click to browse
          </p>
          <p className="text-xs text-[#8b90a0] mt-1">
            TLO Comprehensive Report · Max {MAX_FILE_SIZE_MB}MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            disabled={isBusy}
            onChange={handleInputChange}
          />
        </div>
      )}

      {validationError && (
        <p className="text-sm text-red-400" role="alert">
          {validationError}
        </p>
      )}
      {uploadError && phase === "error" && (
        <p className="text-sm text-red-400" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
