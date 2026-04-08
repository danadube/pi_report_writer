import type { ExtractedData } from "@/types";

/**
 * TODO: Implement PDF text extraction.
 * For MVP, use pdf-parse or a similar library to extract raw text from
 * digitally readable PDFs. Scanned PDFs should be flagged as unsupported.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  // TODO: Send file to /api/extraction/parse-pdf route which
  // uses pdf-parse on the server to extract text content.
  throw new Error("PDF text extraction not yet implemented");
}

/**
 * TODO: Implement TLO section parser.
 * Parse TLO comprehensive report text into structured sections.
 * Use deterministic section-heading matching first before adding
 * AI-assisted extraction as a fallback.
 *
 * Known TLO sections to target:
 * - Personal Information (name, DOB, aliases)
 * - Address History
 * - Phone Numbers
 * - Vehicles
 * - Associates / Relatives
 * - Employment
 */
export async function parseTloReport(rawText: string): Promise<ExtractedData> {
  // TODO: Implement deterministic parser using regex section headings.
  // See: lib/extraction/parsers/tlo-parser.ts (to be created)
  throw new Error("TLO report parser not yet implemented");
}

/**
 * TODO: AI-assisted extraction fallback.
 * When deterministic parsing yields low confidence results,
 * use the OpenAI API or similar to extract structured JSON from raw text.
 * Only invoke this when rule-based parsing fails.
 */
export async function aiAssistedExtraction(
  rawText: string
): Promise<ExtractedData> {
  // TODO: Call /api/extraction/ai-extract with rawText
  throw new Error("AI-assisted extraction not yet implemented");
}

/**
 * Main extraction entry point for TLO uploads.
 * Runs text extraction, then deterministic parsing,
 * with a path for AI fallback in future.
 */
export async function extractFromTloUpload(
  file: File
): Promise<ExtractedData | null> {
  // TODO: Orchestrate the full extraction pipeline:
  // 1. extractTextFromPdf(file)
  // 2. parseTloReport(rawText)
  // 3. Fall back to aiAssistedExtraction if needed
  // 4. Return null and show manual fallback UI if extraction fails
  return null;
}
