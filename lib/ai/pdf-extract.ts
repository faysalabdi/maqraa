import { z } from "zod";

export const ExtractedSchema = z.object({
  title_ar: z.string().nullable().optional(),
  content_ar: z.string(),
});

export type Extracted = z.infer<typeof ExtractedSchema>;

/**
 * Sentinel error for "this server isn't configured to OCR scanned PDFs".
 * Thrown when a chunk has no readable text layer AND no Mistral key is set.
 * The job catches this by name and fails the whole text immediately rather
 * than burning retries on a config problem only the operator can fix.
 */
export class MissingMistralKeyError extends Error {
  constructor() {
    super("MISTRAL_API_KEY is required to OCR scanned PDFs but is not set.");
    this.name = "MissingMistralKeyError";
  }
}

/*
 * Per-chunk Arabic PDF extraction, tried in this order:
 *
 *   1. unpdf — pulls the PDF's embedded text layer. Free, instant. Wins any
 *      digitally-exported Arabic PDF (most modern books, papers, exports).
 *   2. Mistral OCR (`mistral-ocr-latest`) — for scanned pages. ~$1 per 1000
 *      pages, tens of pages per second, strong on Arabic, logical reading order.
 *
 * There is deliberately NO Claude-vision path: it read a chunk in minutes and
 * cost orders of magnitude more. If neither path can run (no text layer AND no
 * MISTRAL_API_KEY) we throw MissingMistralKeyError — the job surfaces a clear,
 * non-transient failure rather than silently grinding for an hour.
 */

export async function extractArabicPdf(pdf: Uint8Array): Promise<Extracted> {
  const layer = await tryTextLayer(pdf);
  if (layer) return { title_ar: null, content_ar: normalizeArabic(layer) };

  if (!process.env.MISTRAL_API_KEY) throw new MissingMistralKeyError();
  return await mistralOcr(pdf);
}

/* ─────────────────────── 1. text-layer fast path ─────────────────────── */

async function tryTextLayer(pdf: Uint8Array): Promise<string | null> {
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const doc = await getDocumentProxy(pdf);
    const { text, totalPages } = await extractText(doc, { mergePages: false });
    const joined = text
      .map((p) => p.trim())
      .filter(Boolean)
      .join("\n\n");
    if (!isUsableArabicLayer(joined, totalPages)) return null;
    return joined;
  } catch {
    return null;
  }
}

/**
 * A text layer is "usable" when it contains a meaningful amount of Arabic per
 * page (rules out scans), is stored in logical Unicode codepoints rather than
 * presentation-form glyphs, AND isn't transposed-ligature garbage. Legacy
 * Arabic typesetting (old InDesign exports and the like) embeds layers that
 * use real Arabic codepoints but store lam ligatures as swapped letter pairs,
 * so الحقيقة comes out احلقيقة, الآن comes out اآلن, في comes out يف — looks
 * like Arabic to a codepoint check, reads as gibberish. Anything that fails
 * falls through to OCR, which reads the rendered page and always produces
 * clean logical-order text.
 */
export function isUsableArabicLayer(text: string, pageCount: number): boolean {
  if (!text) return false;
  let arabic = 0;
  let presentationForms = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= 0x0600 && cp <= 0x06ff) arabic++;
    else if (cp >= 0xfb50 && cp <= 0xfdff) presentationForms++;
    else if (cp >= 0xfe70 && cp <= 0xfeff) presentationForms++;
  }
  if (arabic === 0) return false;
  if (presentationForms > arabic * 0.05) return false;
  if (arabic < Math.max(1, pageCount) * 100) return false;
  return transposedLigatureRatio(text) < 0.01;
}

/**
 * Signature sequences that are (near-)impossible in real Arabic but ubiquitous
 * in transposed-ligature layers:
 *  - األ / اآل / اإل — lam-alef-hamza stored reversed (األولى for الأولى)
 *  - يف / إىل / عىل / حىت — high-frequency prepositions with their ligature
 *    pair swapped (في، إلى، على، حتى); medial ى can't occur in real words
 *  - word-initial احل / اخل / اجل / امل — definite article with its lam-pair
 *    ligature swapped (احلقيقة for الحقيقة)
 * Real prose triggers these at a near-zero rate, corrupted layers at several
 * per sentence, so a 1%-of-words threshold separates them cleanly.
 */
const TRANSPOSED_SIGNATURES =
  /ا[أآإ]ل|(?<![؀-ۿ])(?:(?:يف|إىل|عىل|حىت)(?![؀-ۿ])|ا[حخجم]ل)/g;

function transposedLigatureRatio(text: string): number {
  const hits = text.match(TRANSPOSED_SIGNATURES)?.length ?? 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return words === 0 ? 0 : hits / words;
}

/* ──────────────────────── 2. Mistral OCR ──────────────────────── */

async function mistralOcr(pdf: Uint8Array): Promise<Extracted> {
  const { Mistral } = await import("@mistralai/mistralai");
  const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
  const base64 = Buffer.from(pdf).toString("base64");

  const result = await client.ocr.process(
    {
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        documentUrl: `data:application/pdf;base64,${base64}`,
      },
      includeImageBase64: false,
    },
    // OCR is fast, but allow slack for big chunks + network jitter. The job's
    // own requeue handles transient failures, so no SDK-level retries.
    { retries: { strategy: "none" }, timeoutMs: 120_000 },
  );

  const pages = result.pages.map((p) => markdownToPlain(p.markdown));
  const cleaned = stripRunningHeadersFooters(pages);
  const content = cleaned.filter((s) => s.length > 0).join("\n\n");

  return { title_ar: null, content_ar: normalizeArabic(content) };
}

/**
 * Mistral OCR returns markdown — we want plain Arabic prose. Drop image
 * markers and inline markup, keep paragraph breaks.
 */
function markdownToPlain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Detect running headers/footers within a chunk of OCR-extracted pages and
 * strip them. A running header/footer is a short line (≤6 words) that repeats
 * as the FIRST or LAST non-empty line of three or more pages in the chunk —
 * the chapter title, the book name, "Page 19". We compare with digits and
 * punctuation stripped so "Page 19" and "Page 20" count as the same header.
 *
 * Standalone page-number lines (just digits, Arabic or Latin) are dropped from
 * any position. Everything else is left untouched.
 */
export function stripRunningHeadersFooters(pages: string[]): string[] {
  const firstCount = new Map<string, number>();
  const lastCount = new Map<string, number>();
  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const first = headerKey(lines[0]);
    const last = headerKey(lines[lines.length - 1]);
    if (first) firstCount.set(first, (firstCount.get(first) ?? 0) + 1);
    if (last && last !== first) lastCount.set(last, (lastCount.get(last) ?? 0) + 1);
  }
  const repeatedFirst = new Set(
    [...firstCount.entries()].filter(([, n]) => n >= 3).map(([k]) => k),
  );
  const repeatedLast = new Set(
    [...lastCount.entries()].filter(([, n]) => n >= 3).map(([k]) => k),
  );

  return pages.map((page) => {
    const lines = page.split("\n");
    let start = 0;
    let end = lines.length;
    while (start < end) {
      const t = lines[start].trim();
      if (t === "" || isPageNumberLine(t) || repeatedFirst.has(headerKey(t))) start++;
      else break;
    }
    while (end > start) {
      const t = lines[end - 1].trim();
      if (t === "" || isPageNumberLine(t) || repeatedLast.has(headerKey(t))) end--;
      else break;
    }
    return lines.slice(start, end).join("\n").trim();
  });
}

/**
 * Comparison key for a header/footer line: strip digits, whitespace, and
 * common punctuation, and bail out for lines longer than 6 words (real prose,
 * not a running label). Returns "" when the line isn't a header candidate.
 */
function headerKey(line: string): string {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return "";
  return line.replace(/[\d٠-٩\s.,،؛:\-–—|]+/g, "").trim();
}

function isPageNumberLine(line: string): boolean {
  return /^[\d٠-٩]{1,4}$/.test(line.replace(/[\s.,\-–—|]/g, ""));
}

/* ─────────────────────── shared text normalization ─────────────────────── */

/**
 * Cheap, instant cleanup applied to both paths. Fixes the structural artifacts
 * that make extracted Arabic read badly — stray latin-only lines, runaway
 * spacing, single newlines mid-paragraph — without any model call. Mistral OCR
 * output is already logical-order and well-segmented, so this is light-touch.
 */
function normalizeArabic(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) =>
      para
        // Collapse single line breaks inside a paragraph into spaces (verse and
        // real paragraph boundaries are double newlines, preserved by the split).
        .replace(/\s*\n\s*/g, " ")
        .replace(/[ \t ]{2,}/g, " ")
        // Normalize spacing around Arabic punctuation.
        .replace(/\s+([،؛؟!.])/g, "$1")
        .trim(),
    )
    .filter((para) => para.length > 0)
    // Drop paragraphs with no Arabic at all (page numbers, stray latin scraps).
    .filter((para) => /[؀-ۿ]/.test(para))
    .join("\n\n")
    .trim();
}
