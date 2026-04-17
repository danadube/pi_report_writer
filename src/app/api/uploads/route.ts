import { createClient } from "@/lib/supabase/server";
import {
  REPORT_FILES_BUCKET,
  assertPdfFile,
  buildReportObjectPath,
} from "@/lib/storage/report-files";
import { NextResponse } from "next/server";
import { SourceDocumentType, type ReportSource } from "@/types";

/**
 * POST /api/uploads
 * Multipart form: file (PDF), reportId (uuid).
 * Uploads to Supabase Storage and inserts report_sources (source_type TLO_COMPREHENSIVE for TLO PDFs).
 *
 * TODO: Extraction pipeline hook after successful upload.
 * TODO: If bucket is private, store path and serve signed download URLs from a dedicated route.
 */
export async function POST(request: Request) {
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

  const {
    data: { publicUrl },
  } = supabase.storage.from(REPORT_FILES_BUCKET).getPublicUrl(objectPath);

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

  const source: ReportSource = {
    id: sourceRow.id,
    report_id: sourceRow.report_id,
    source_type: sourceRow.source_type as ReportSource["source_type"],
    file_name: sourceRow.file_name,
    file_url: sourceRow.file_url,
    extracted_text: sourceRow.extracted_text,
    created_at: sourceRow.created_at,
  };

  return NextResponse.json(
    {
      source,
      fileUrl: publicUrl,
      path: objectPath,
      bucket: REPORT_FILES_BUCKET,
    },
    { status: 201 }
  );
}
