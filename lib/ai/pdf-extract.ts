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
 * Per-chunk Arabic PDF extraction:
 *
 *   1. unpdf — pulls the PDF's embedded text layer. Free, instant. Wins any
 *      digitally-exported Arabic PDF with a healthy layer outright.
 *   2. Claude text repair — for layers that exist but are transposed-ligature
 *      garbage (legacy typesetting). The text is all there, just letter-pair
 *      scrambled; a text-only model call unscrambles it in seconds. No vision.
 *   3. Mistral OCR (`mistral-ocr-latest`) — for true scans with no layer at
 *      all. ~$1 per 1000 pages, tens of pages per second.
 *
 * There is deliberately NO Claude-vision path: it read a chunk in minutes and
 * cost orders of magnitude more. If only OCR can help and MISTRAL_API_KEY is
 * unset we throw MissingMistralKeyError — the job surfaces a clear,
 * non-transient failure rather than silently grinding for an hour.
 */

export async function extractArabicPdf(pdf: Uint8Array): Promise<Extracted> {
  const layer = await readTextLayer(pdf);
  if (layer) {
    const pages = stripRunningHeadersFooters(layer.pages);
    const joined = pages.filter(Boolean).join("\n\n");
    const verdict = classifyArabicLayer(joined, layer.totalPages);

    if (verdict === "clean") {
      return { title_ar: null, content_ar: normalizeArabic(joined) };
    }
    if (verdict === "transposed") {
      try {
        const fixed = await fixTransposedArabic(joined);
        return { title_ar: null, content_ar: normalizeArabic(fixed) };
      } catch (e) {
        // Text repair is the cheap path; OCR of the rendered page is the
        // ground-truth fallback when it misbehaves.
        console.error("[pdf-extract] transposed-layer repair failed, falling back to OCR", e);
        if (!process.env.MISTRAL_API_KEY) throw e;
        return await mistralOcr(pdf);
      }
    }
  }

  if (!process.env.MISTRAL_API_KEY) throw new MissingMistralKeyError();
  return await mistralOcr(pdf);
}

/* ─────────────────────── 1. text-layer fast path ─────────────────────── */

async function readTextLayer(
  pdf: Uint8Array,
): Promise<{ pages: string[]; totalPages: number } | null> {
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const doc = await getDocumentProxy(pdf);
    const { text, totalPages } = await extractText(doc, { mergePages: false });
    return { pages: text.map((p) => p.trim()), totalPages };
  } catch {
    return null;
  }
}

export type LayerVerdict = "clean" | "transposed" | "unusable";

/**
 * Classify a text layer:
 *  - "clean"      — logical-order Arabic, use as-is.
 *  - "transposed" — full text is present but legacy typesetting stored lam
 *    ligatures as swapped letter pairs (الحقيقة reads احلقيقة, في reads يف,
 *    الآن reads اآلن). Real codepoints, scrambled words — repairable by a
 *    text-only model call.
 *  - "unusable"   — empty, too sparse for the page count (a scan), or
 *    presentation-form glyph soup. Only OCR of the rendered page helps.
 */
export function classifyArabicLayer(text: string, pageCount: number): LayerVerdict {
  if (!text) return "unusable";
  let arabic = 0;
  let presentationForms = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= 0x0600 && cp <= 0x06ff) arabic++;
    else if (cp >= 0xfb50 && cp <= 0xfdff) presentationForms++;
    else if (cp >= 0xfe70 && cp <= 0xfeff) presentationForms++;
  }
  if (arabic === 0) return "unusable";
  if (presentationForms > arabic * 0.05) return "unusable";
  if (arabic < Math.max(1, pageCount) * 100) return "unusable";
  return transposedLigatureRatio(text) < 0.01 ? "clean" : "transposed";
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

/* ──────────────── 2. Claude text repair (transposed layers) ──────────────── */

const FIX_SYSTEM = `You repair Arabic text that was extracted from a PDF typeset with a corrupted legacy font encoding. The corruption swaps the letter order inside lam ligatures and similar pairs. Examples of the corruption and the correct form:

احلقيقة → الحقيقة
اخلطوة → الخطوة
اجلسد → الجسد
املتكررة → المتكررة
األيام → الأيام
اآلن → الآن
اإلسالم → الإسلام
يف → في
إىل → إلى
عىل → على
حىت → حتى
ال يحدث → لا يحدث (standalone ال as a word is usually لا)

Rewrite the user's text with the corruption fixed. Rules:
- Fix ONLY the letter-order/encoding corruption. Do NOT translate, summarize, rephrase, reorder, add, or remove anything.
- Keep all punctuation, numbers, diacritics, and paragraph breaks exactly where they are.
- Rejoin words the corruption split with a stray space (e.g. تغي ري → تغيير) when unambiguous.
- Output ONLY the corrected text — no preamble, no commentary.`;

/**
 * Unscramble a transposed-ligature layer with a fast text-only model. The
 * text is split on paragraph boundaries into ~4k-char segments so each
 * response stays far below the output-token cap, and segments are repaired a
 * few at a time in parallel. Anthropic client is imported lazily so this
 * module stays importable without env configuration (unit tests).
 */
async function fixTransposedArabic(text: string): Promise<string> {
  const { anthropic, FALLBACK_MODEL } = await import("./anthropic");
  const segments = segmentParagraphs(text, 4000);

  async function fixSegment(segment: string): Promise<string> {
    const res = await anthropic.messages.create(
      {
        model: FALLBACK_MODEL,
        max_tokens: 8000,
        temperature: 0,
        system: [{ type: "text", text: FIX_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: segment }],
      },
      { timeout: 90_000, maxRetries: 1 },
    );
    const block = res.content.find((c) => c.type === "text");
    const fixed = block && block.type === "text" ? block.text.trim() : "";
    // A faithful repair preserves length to within noise; anything far off
    // means the model summarized or bailed — better to fall back to OCR.
    if (fixed.length < segment.length * 0.5 || fixed.length > segment.length * 1.6) {
      throw new Error(
        `transposed repair length mismatch (${segment.length} chars in, ${fixed.length} out)`,
      );
    }
    return fixed;
  }

  const out: string[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < segments.length; i += CONCURRENCY) {
    const fixed = await Promise.all(segments.slice(i, i + CONCURRENCY).map(fixSegment));
    out.push(...fixed);
  }
  return out.join("\n\n");
}

function segmentParagraphs(text: string, maxChars: number): string[] {
  const paras = text.split(/\n{2,}/);
  const segments: string[] = [];
  let current = "";
  for (const para of paras) {
    if (current && current.length + para.length + 2 > maxChars) {
      segments.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) segments.push(current);
  return segments;
}

/* ──────────────────────── 3. Mistral OCR ──────────────────────── */

async function mistralOcr(pdf: Uint8Array): Promise<Extracted> {
  const base64 = Buffer.from(pdf).toString("base64");
  return await runMistralOcr({
    type: "document_url",
    documentUrl: `data:application/pdf;base64,${base64}`,
  });
}

/**
 * Run Mistral OCR over a specific page range of a PDF. Used by the extractor
 * to recover chunks whose pdf-lib slice came out as 0 bytes — we OCR that
 * range straight from the preserved source upload instead of dropping it.
 * `pageStart`/`pageEnd` are 0-indexed half-open, matching how chunks are
 * stored. Mistral's `pages` parameter is also 0-indexed.
 */
export async function ocrPdfPageRange(
  source: Uint8Array,
  pageStart: number,
  pageEnd: number,
): Promise<Extracted> {
  if (pageEnd <= pageStart) return { title_ar: null, content_ar: "" };
  if (!process.env.MISTRAL_API_KEY) throw new MissingMistralKeyError();
  const base64 = Buffer.from(source).toString("base64");
  const pages = Array.from({ length: pageEnd - pageStart }, (_, i) => pageStart + i);
  return await runMistralOcr(
    {
      type: "document_url",
      documentUrl: `data:application/pdf;base64,${base64}`,
    },
    pages,
  );
}

async function runMistralOcr(
  document: { type: "document_url"; documentUrl: string },
  pages?: number[],
): Promise<Extracted> {
  const { Mistral } = await import("@mistralai/mistralai");
  const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

  const result = await client.ocr.process(
    {
      model: "mistral-ocr-latest",
      document,
      includeImageBase64: false,
      ...(pages ? { pages } : {}),
    },
    // OCR runs at tens of pages per second, so even a 50-page chunk should
    // finish well under a minute — a tight bound makes a hanging call fail
    // fast and visibly instead of looking like a frozen import. The job's own
    // requeue handles transient failures, so no SDK-level retries.
    { retries: { strategy: "none" }, timeoutMs: 60_000 },
  );

  const pageMarkdowns = result.pages.map((p) => markdownToPlain(p.markdown));
  const cleaned = stripRunningHeadersFooters(pageMarkdowns);
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

/**
 * Post-process Arabic text the browser already extracted from a PDF (via
 * pdfjs-dist + cMaps). The browser produces logical-order codepoints in
 * sub-second time, but two things still need server-side cleanup:
 *  - Running headers / footers / page-number lines that PDF.js dutifully
 *    includes in every page's text layer. Stripped per-page.
 *  - Transposed-ligature corruption (الحقيقة → احلقيقة, في → يف, etc.) baked
 *    into the source typesetting. Mapped back to real Arabic with a fast
 *    text-only Claude pass when the classifier sees it.
 *
 * Returns the cleaned, joined content ready for sectionize().
 */
export async function processBrowserExtractedPages(
  pages: string[],
): Promise<{ content: string; repaired: boolean }> {
  const cleaned = stripRunningHeadersFooters(pages.map((p) => p.trim()));
  const stripped = stripTatweel(cleaned.join("\n\n"));
  const verdict = classifyArabicLayer(stripped, Math.max(1, pages.length));

  if (verdict === "transposed") {
    try {
      const fixed = await fixTransposedArabic(stripped);
      return { content: normalizeArabic(fixed), repaired: true };
    } catch (e) {
      console.error("[pdf-extract] browser-extracted repair failed; using raw text", e);
      return { content: normalizeArabic(stripped), repaired: false };
    }
  }
  return { content: normalizeArabic(stripped), repaired: false };
}

/**
 * Strip Arabic tatweel/kashida (U+0640). It's a visual stretch character used
 * in justified typesetting and shouldn't appear in reading text — extractors
 * sometimes pull it through and it splits words like "تغييرًا" into "تغيـرًا".
 */
function stripTatweel(text: string): string {
  return text.replace(/ـ/g, "");
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
