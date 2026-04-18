/**
 * Server-side PDF text extraction using `unpdf` (Mozilla PDF.js build for serverless).
 * Works for digitally generated PDFs; image-only / scanned PDFs often yield empty text.
 *
 * @see https://github.com/unjs/unpdf — edge/serverless–safe; avoids the pdf-parse/canvas/DOM path.
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

  let extractText: typeof import("unpdf").extractText;
  try {
    ({ extractText } = await import("unpdf"));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`PDF engine (unpdf) failed to load: ${detail}`);
  }

  try {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return typeof text === "string" ? text : "";
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`PDF text extraction failed (unpdf): ${detail}`);
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
