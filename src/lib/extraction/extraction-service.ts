import type { ExtractedData } from "@/types";
import { parseTlo } from "@/lib/extraction/parsers/tlo-parser";

/**
 * TODO: Send file to server route for buffer extraction when calling from client.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  throw new Error("PDF text extraction not yet implemented");
}

/**
 * Parse TLO-style plain text into structured sections (heuristic).
 */
export async function parseTloReport(rawText: string): Promise<ExtractedData> {
  return parseTlo(rawText);
}

/**
 * TODO: AI-assisted extraction fallback.
 */
export async function aiAssistedExtraction(
  rawText: string
): Promise<ExtractedData> {
  throw new Error("AI-assisted extraction not yet implemented");
}

/**
 * TODO: Orchestrate full pipeline from browser file handle.
 */
export async function extractFromTloUpload(
  file: File
): Promise<ExtractedData | null> {
  return null;
}
