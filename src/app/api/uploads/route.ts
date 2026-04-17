import { createClient } from "@/lib/supabase/server";
import {
  REPORT_FILES_BUCKET,
  assertPdfFile,
  buildReportObjectPath,
  buildStoragePublicObjectUrl,
  validateSupabaseUrlForStorage,
} from "@/lib/storage/report-files";
import { NextResponse } from "next/server";
import { SourceDocumentType, type ReportSource } from "@/types";

const UPLOAD_EXTRACTION_ERROR_MAX_LEN = 5000;

async function persistExtractionFailureFromUpload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceId: string,
  reportId: string,
  err: unknown
): Promise<void> {
  const raw =
    err instanceof Error ? err.message : "Extraction failed (unexpected error)";
  const trimmed =
    raw.length > UPLOAD_EXTRACTION_ERROR_MAX_LEN
      ? `${raw.slice(0, UPLOAD_EXTRACTION_ERROR_MAX_LEN)}…`
      : raw;
  const { error } = await supabase
    .from("report_sources")
    .update({
      extraction_status: "failed",
      extraction_error: trimmed,
    })
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (error) {
    console.error(
      "[uploads] failed to persist extraction_error after extraction failure:",
      error.message
    );
  }
}

/**
 * POST /api/uploads
 * Multipart form: file (PDF), reportId (uuid).
 * Uploads to Supabase Storage and inserts report_sources (source_type TLO_COMPREHENSIVE for TLO PDFs).
 *
 * Post-upload extraction runs in-process (PDF text → report_sources.extracted_text).
 * TODO: If bucket is private, store path and serve signed download URLs from a dedicated route.
 */
export async function POST(request: Request) {
  const urlCheck = validateSupabaseUrlForStorage(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!urlCheck.ok) {
    console.error("[uploads] Invalid NEXT_PUBLIC_SUPABASE_URL:", urlCheck.message);
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL must be your Supabase project URL (see logs).",
      },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const reportIdRaw = formData.get("reportId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (typeof reportIdRaw !== "string" || reportIdRaw.length === 0) {
    return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
  }

  const reportId = reportIdRaw;

  const valid = assertPdfFile(file);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("created_by_user_id", user.id)
    .maybeSingle();

  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const objectPath = buildReportObjectPath(reportId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(REPORT_FILES_BUCKET)
    .upload(objectPath, file, {
      upsert: false,
      contentType: "application/pdf",
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const publicUrl = buildStoragePublicObjectUrl(
    urlCheck.url,
    REPORT_FILES_BUCKET,
    objectPath
  );

  const sourceInsert = {
    report_id: reportId,
    source_type: SourceDocumentType.TLO_COMPREHENSIVE,
    file_name: file.name,
    file_url: publicUrl,
  };

  const { data: sourceRow, error: insertError } = await supabase
    .from("report_sources")
    .insert(sourceInsert)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    const { runExtractionForSource } = await import(
      "@/lib/extraction/extraction-pipeline"
    );
    const ex = await runExtractionForSource(supabase, {
      sourceId: sourceRow.id,
      reportId,
      storageObjectPath: objectPath,
    });
    if (!ex.ok) {
      console.error("[uploads] extraction:", ex.message);
    }
  } catch (e) {
    console.error("[uploads] extraction threw:", e);
    await persistExtractionFailureFromUpload(supabase, sourceRow.id, reportId, e);
  }

  const {
    data: sourceAfterExtraction,
    error: reloadError,
  } = await supabase
    .from("report_sources")
    .select("*")
    .eq("id", sourceRow.id)
    .maybeSingle();

  const reloadFailed = reloadError !== null || sourceAfterExtraction === null;

  if (reloadError) {
    console.error(
      "[uploads] failed to reload report_sources after extraction:",
      reloadError.message
    );
  } else if (sourceAfterExtraction === null) {
    console.error(
      "[uploads] report_sources row missing on reload (id=%s)",
      sourceRow.id
    );
  }

  const row = reloadFailed ? sourceRow : sourceAfterExtraction;

  const source: ReportSource = {
    id: row.id,
    report_id: row.report_id,
    source_type: row.source_type as ReportSource["source_type"],
    file_name: row.file_name,
    file_url: row.file_url,
    extracted_text: row.extracted_text,
    extraction_status: row.extraction_status,
    extraction_error: row.extraction_error,
    created_at: row.created_at,
  };

  return NextResponse.json(
    {
      source,
      sourceReloadFailed: reloadFailed,
      ...(reloadError ? { reloadError: reloadError.message } : {}),
      fileUrl: publicUrl,
      path: objectPath,
      bucket: REPORT_FILES_BUCKET,
    },
    { status: 201 }
  );
}
