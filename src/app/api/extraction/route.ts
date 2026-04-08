import { NextResponse } from "next/server";

/**
 * POST /api/extraction
 * Accepts { reportId, sourceId, rawText } and runs the TLO parser.
 * Returns structured ExtractedData.
 *
 * TODO: Implement parseTloReport from lib/extraction/extraction-service.ts
 * TODO: Store parsed results in extracted_* tables in Supabase
 * TODO: Add source_type routing (TLO vs DMV vs other)
 */
export async function POST() {
  // TODO: Implement extraction pipeline
  return NextResponse.json(
    { error: "Extraction not yet implemented" },
    { status: 501 }
  );
}
