import { PDFParse } from "pdf-parse";

/**
 * Server-side PDF text extraction using `pdf-parse` (pdf.js).
 * Works for digitally generated PDFs; image-only / scanned PDFs often yield empty text.
 *
 * @see https://www.npmjs.com/package/pdf-parse
 */
export const MAX_EXTRACTED_CHARS = 2_000_000;

/** Reject pathological PDFs before pdf.js work (memory / runtime on serverless). */
export const MAX_PDF_BYTES = 32 * 1024 * 1024;

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  if (buffer.length === 0) {
    throw new Error("PDF file is empty");
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(
      `PDF exceeds maximum size (${(MAX_PDF_BYTES / (1024 * 1024)).toFixed(0)}MB)`
    );
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return typeof result.text === "string" ? result.text : "";
  } finally {
    await parser.destroy();
  }
}

/** Guard very large documents for Postgres row size and UI performance. */
export function maybeTruncateExtractedText(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) {
    return text;
  }
  return (
    text.slice(0, MAX_EXTRACTED_CHARS) +
    "\n\n[Text truncated to " +
    MAX_EXTRACTED_CHARS.toLocaleString() +
    " characters]"
  );
}
