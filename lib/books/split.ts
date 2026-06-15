/**
 * Split a whole pasted book into chapter drafts. Pure + deterministic so it can
 * be unit-tested and previewed client-side before anything is written. Works on
 * already-clean text only — no OCR, no PDF parsing.
 */

export type SplitMode = "heading" | "separator" | "size";

export type SplitOptions = {
  mode: SplitMode;
  separator?: string; // for "separator"
  charsPerChapter?: number; // for "size"
};

export type DraftChapter = {
  titleAr: string;
  titleEn: string;
  contentAr: string;
};

// Lines that begin with a common Arabic structural word are treated as chapter
// headings in "heading" mode. JS `\b` doesn't fire next to Arabic letters, so we
// require the keyword to be followed by whitespace/punctuation/end instead, and
// strip diacritics before matching so fully-vowelized text still works.
const DIACRITICS = /[ً-ْٰـ]/g;
const HEADING_RE =
  /^[ \t]*(?:الفصل|الباب|الحديث|المقدمة|مقدمة|الخاتمة|خاتمة|تمهيد|القسم|الجزء|الدرس|الوحدة|الحكاية|القصة|المبحث)(?=[\s:：،.\-–—()]|$)/;

function isHeading(line: string): boolean {
  return HEADING_RE.test(line.replace(DIACRITICS, ""));
}

function deriveChapter(chunk: string, index: number): DraftChapter {
  const lines = chunk.split("\n");
  let firstIdx = 0;
  while (firstIdx < lines.length && lines[firstIdx].trim() === "") firstIdx++;
  const first = (lines[firstIdx] ?? "").trim();

  // A short opening line that doesn't end like a sentence is almost certainly a
  // heading, so lift it out as the title and keep the rest as the body.
  const looksLikeTitle = first.length > 0 && first.length <= 80 && !/[.!؟،]$/.test(first);
  if (looksLikeTitle) {
    const body = lines.slice(firstIdx + 1).join("\n").trim();
    if (body.length > 0) {
      return { titleAr: first, titleEn: `Chapter ${index + 1}`, contentAr: body };
    }
  }
  return {
    titleAr: `الفصل ${index + 1}`,
    titleEn: `Chapter ${index + 1}`,
    contentAr: chunk.trim(),
  };
}

function chunksToChapters(chunks: string[]): DraftChapter[] {
  return chunks
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .map(deriveChapter);
}

export function splitIntoChapters(text: string, opts: SplitOptions): DraftChapter[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized.trim().length === 0) return [];

  if (opts.mode === "separator") {
    const sep = (opts.separator ?? "---").trim();
    if (!sep) return chunksToChapters([normalized]);
    const chunks: string[] = [];
    let cur: string[] = [];
    for (const line of normalized.split("\n")) {
      if (line.trim() === sep) {
        chunks.push(cur.join("\n"));
        cur = [];
      } else {
        cur.push(line);
      }
    }
    chunks.push(cur.join("\n"));
    return chunksToChapters(chunks);
  }

  if (opts.mode === "heading") {
    const chunks: string[] = [];
    let cur: string[] = [];
    for (const line of normalized.split("\n")) {
      const startsNew = isHeading(line) && cur.some((l) => l.trim() !== "");
      if (startsNew) {
        chunks.push(cur.join("\n"));
        cur = [line];
      } else {
        cur.push(line);
      }
    }
    chunks.push(cur.join("\n"));
    return chunksToChapters(chunks);
  }

  // size: pack whole paragraphs up to a target length.
  const target = Math.max(300, opts.charsPerChapter ?? 1500);
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paragraphs) {
    if (cur.length > 0 && cur.length + p.length > target) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunksToChapters(chunks);
}
