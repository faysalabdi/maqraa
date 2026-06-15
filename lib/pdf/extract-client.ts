"use client";

/**
 * Browser-side PDF text extractor.
 *
 * Loads PDF.js in the browser with cMaps configured — that's the single
 * difference between getting clean logical-order Arabic out of a digital PDF
 * and getting transposed-ligature gibberish. The cMaps map a CIDFont's glyph
 * codes back to Unicode codepoints; without them PDF.js falls back to glyph
 * codes that look like Arabic but read in the wrong order, which is what
 * generated all the previous repair plumbing.
 *
 * Per-page items are grouped by Y position (a new line when Y drops by more
 * than half a line height) and items inside a line are joined RTL — Arabic
 * PDFs commonly emit items in reading order anyway, but the grouping fixes
 * the multi-column / footnoted pages where they don't.
 *
 * Returns the extracted pages and a verdict: usable (good Arabic text layer,
 * import as text) or no-text-layer (scan, fall back to upload + OCR).
 */

import * as pdfjs from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Version-pinned CDN to match the installed pdfjs-dist. Saves shipping ~10 MB
// of cmap files in the app bundle, and the worker has no app-specific code.
const PDFJS_VERSION = pdfjs.version;
const CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;
const WORKER_SRC = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

let workerConfigured = false;
function ensureWorker() {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  workerConfigured = true;
}

export type ExtractResult =
  | { kind: "text"; pages: string[]; totalArabicChars: number }
  | { kind: "no-text-layer"; reason: string };

export type ExtractProgress = (loaded: number, total: number) => void;

export async function extractPdfInBrowser(
  file: File,
  onProgress?: ExtractProgress,
): Promise<ExtractResult> {
  ensureWorker();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    // Most Arabic books we see are owner-protected — same options the server
    // path uses to actually open them.
    password: "",
    disableAutoFetch: true,
    disableStream: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const pages: string[] = [];
  let totalArabicChars = 0;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const lines = groupIntoLines(content.items as TextItem[]);
    const pageText = lines.join("\n");
    pages.push(pageText);

    for (const ch of pageText) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined && cp >= 0x0600 && cp <= 0x06ff) totalArabicChars++;
    }

    onProgress?.(i, totalPages);
  }

  if (totalArabicChars < totalPages * 30) {
    return {
      kind: "no-text-layer",
      reason:
        totalArabicChars === 0
          ? "No selectable text in this PDF — looks like scanned page images."
          : "Too little Arabic text in the layer — probably a scanned PDF with stray OCR.",
    };
  }

  return { kind: "text", pages, totalArabicChars };
}

/**
 * Group PDF.js text items into lines by Y position, then join inside each
 * line in reading order. PDF.js's `transform` is [a, b, c, d, e, f]; [4] is
 * X, [5] is Y in PDF coords (origin bottom-left). A "new line" is any drop in
 * Y greater than half the item's height. Within a line items are sorted by X
 * descending — Arabic reads right-to-left, so the rightmost item is first.
 */
function groupIntoLines(items: TextItem[]): string[] {
  type Run = { x: number; y: number; h: number; str: string };
  const runs: Run[] = items
    .filter((it) => it.str && it.str.length > 0)
    .map((it) => ({
      x: it.transform[4],
      y: it.transform[5],
      h: it.height || 12,
      str: it.str,
    }));

  if (runs.length === 0) return [];

  // Stable sort by Y descending (top to bottom on the page).
  runs.sort((a, b) => b.y - a.y);

  const lines: Run[][] = [];
  let currentLine: Run[] = [runs[0]];
  let currentY = runs[0].y;
  let currentH = runs[0].h;

  for (let i = 1; i < runs.length; i++) {
    const r = runs[i];
    if (Math.abs(r.y - currentY) <= Math.max(2, currentH * 0.6)) {
      currentLine.push(r);
    } else {
      lines.push(currentLine);
      currentLine = [r];
      currentY = r.y;
      currentH = r.h;
    }
  }
  lines.push(currentLine);

  return lines.map((line) => {
    // RTL within a line: rightmost item first.
    line.sort((a, b) => b.x - a.x);
    return line
      .map((r) => r.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }).filter((s) => s.length > 0);
}

/**
 * Pages → reading content. Single newlines inside a page become paragraph
 * separators (each PDF line is its own paragraph for sectionizing); pages
 * are joined by double newlines so the per-page boundaries are preserved
 * as paragraph breaks. The reader's sectionizer takes it from there.
 */
export function pagesToContent(pages: string[]): string {
  return pages
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}
