import { createClient } from "@/lib/supabase/server";
import {
  REPORT_FILES_BUCKET,
  normalizeStorageObjectPath,
  resolveReportSourceFileUrl,
  storageObjectPathFromPublicUrl,
} from "@/lib/storage/report-files";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; sourceId: string }>;
}

function resolveStorageObjectPath(
  fileUrl: string | null
): string | null {
  if (fileUrl == null || typeof fileUrl !== "string") {
    return null;
  }
  const raw = fileUrl.trim();
  if (!raw) {
    return null;
  }
  const resolved = resolveReportSourceFileUrl(raw);
  let path = storageObjectPathFromPublicUrl(resolved, REPORT_FILES_BUCKET);
  if (!path && /^https?:\/\//i.test(raw)) {
    path = storageObjectPathFromPublicUrl(raw, REPORT_FILES_BUCKET);
  }
  if (!path) {
    return normalizeStorageObjectPath(raw);
  }
  return normalizeStorageObjectPath(path);
}

/**
 * DELETE /api/reports/[id]/sources/[sourceId]
 * Removes extracted_* rows (RPC), the report_sources row, then the Storage object.
 * Report must be owned by the current user; source must belong to that report.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: reportId, sourceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ownedReport, error: ownedErr } = await supabase
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("created_by_user_id", user.id)
    .maybeSingle();

  if (ownedErr) {
    return NextResponse.json({ error: ownedErr.message }, { status: 500 });
  }
  if (!ownedReport) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: sourceRow, error: srcErr } = await supabase
    .from("report_sources")
    .select("id, report_id, file_url")
    .eq("id", sourceId)
    .eq("report_id", reportId)
    .maybeSingle();

  if (srcErr) {
    return NextResponse.json({ error: srcErr.message }, { status: 500 });
  }
  if (!sourceRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const objectPath = resolveStorageObjectPath(sourceRow.file_url);

  const { error: rpcErr } = await supabase.rpc("delete_extracted_for_source", {
    p_report_id: reportId,
    p_source_id: sourceId,
  });
  if (rpcErr) {
    return NextResponse.json(
      { error: `Failed to clear extracted data: ${rpcErr.message}` },
      { status: 500 }
    );
  }

  const { error: delSrcErr } = await supabase
    .from("report_sources")
    .delete()
    .eq("id", sourceId)
    .eq("report_id", reportId);

  if (delSrcErr) {
    return NextResponse.json(
      { error: `Failed to remove source record: ${delSrcErr.message}` },
      { status: 500 }
    );
  }

  let storageWarning: string | null = null;
  if (objectPath) {
    const { error: stErr } = await supabase.storage
      .from(REPORT_FILES_BUCKET)
      .remove([objectPath]);
    if (stErr) {
      console.error(
        "[delete source] storage remove failed after DB delete:",
        objectPath,
        stErr.message
      );
      storageWarning = stErr.message;
    }
  }

  return NextResponse.json({
    ok: true as const,
    ...(storageWarning ? { storageWarning } : {}),
  });
}
