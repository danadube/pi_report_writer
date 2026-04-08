"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtractionStatus } from "@/types";

interface DocumentUploadProps {
  onFileSelected: (file: File) => void;
  status: ExtractionStatus;
  accept?: string;
}

const MAX_FILE_SIZE_MB = 20;
const ACCEPTED_TYPES = ["application/pdf"];

export function DocumentUpload({
  onFileSelected,
  status,
  accept = ".pdf",
}: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndSelect(file: File) {
    setValidationError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setValidationError("Only PDF files are supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setValidationError(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setSelectedFile(file);
    onFileSelected(file);
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
    if (inputRef.current) inputRef.current.value = "";
  }

  const isProcessing = status === "uploading" || status === "parsing";

  return (
    <div className="space-y-2">
      {selectedFile ? (
        <div className="flex items-center justify-between rounded-lg border border-[#2a2f42] bg-[#161922] px-4 py-3">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-[#4f7ef5] flex-shrink-0" />
            <div>
              <p className="text-sm text-[#e8eaf0] font-medium">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[#8b90a0]">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={clearFile}
              className="text-[#8b90a0] hover:text-[#e8eaf0] transition-colors"
            >
              <X size={16} />
            </button>
          )}
          {isProcessing && (
            <span className="text-xs text-[#4f7ef5] animate-pulse">
              {status === "uploading" ? "Uploading…" : "Parsing…"}
            </span>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
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
            onChange={handleInputChange}
          />
        </div>
      )}

      {validationError && (
        <p className="text-sm text-red-400">{validationError}</p>
      )}
    </div>
  );
}
