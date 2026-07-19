/**
 * Stage 3 — pack normalized pages into model-sized chunks.
 *
 * Breaks only on page boundaries, never mid-page. Each chunk carries explicit
 * [[PAGE n]] markers so the model can tell page edges from paragraph breaks,
 * and a tagged overlap tail from the previous chunk so a chapter heading that
 * straddles a boundary is still detected (the model is told not to repeat it).
 */

export type PdfPage = { page: number; text: string };

export type TextChunk = {
  index: number;
  text: string;
  fromPage: number;
  toPage: number;
};

export type ChunkOptions = {
  /** Hard page cap per chunk (default 12). */
  pagesPerChunk?: number;
  /**
   * Soft character cap per chunk (default 20000). Whole pages only — a page is
   * never split; a single oversized page becomes its own chunk.
   */
  maxCharsPerChunk?: number;
  /** Tail of the previous chunk prepended as tagged context (default 200). */
  overlapChars?: number;
};

export const PAGE_MARKER = (n: number) => `[[PAGE ${n}]]`;

export const OVERLAP_OPEN = "[[OVERLAP — context from the previous chunk; do NOT repeat it in your output]]";
export const OVERLAP_CLOSE = "[[END OVERLAP]]";

export function chunkPages(pages: PdfPage[], opts: ChunkOptions = {}): TextChunk[] {
  const pagesPerChunk = Math.max(1, opts.pagesPerChunk ?? 12);
  const maxChars = Math.max(1000, opts.maxCharsPerChunk ?? 20000);
  const overlap = Math.max(0, opts.overlapChars ?? 200);

  const nonEmpty = pages.filter((p) => p.text.trim().length > 0);
  const chunks: TextChunk[] = [];

  let group: PdfPage[] = [];
  let groupChars = 0;

  const flush = () => {
    if (group.length === 0) return;
    let text = group.map((p) => `${PAGE_MARKER(p.page)}\n${p.text.trim()}`).join("\n\n");
    if (chunks.length > 0 && overlap > 0) {
      const tail = chunks[chunks.length - 1].text.slice(-overlap).trim();
      if (tail) text = `${OVERLAP_OPEN}\n${tail}\n${OVERLAP_CLOSE}\n\n${text}`;
    }
    chunks.push({
      index: chunks.length,
      text,
      fromPage: group[0].page,
      toPage: group[group.length - 1].page,
    });
  };

  for (const page of nonEmpty) {
    const pageLen = page.text.trim().length;
    const overPages = group.length >= pagesPerChunk;
    const overChars = group.length > 0 && groupChars + pageLen > maxChars;
    if (overPages || overChars) {
      flush();
      group = [];
      groupChars = 0;
    }
    group.push(page);
    groupChars += pageLen;
  }
  flush();

  return chunks;
}
