import { z } from "zod";
import { anthropic, TEST_MODEL } from "./anthropic";

export const ExtractedSchema = z.object({
  title_ar: z.string().nullable().optional(),
  content_ar: z.string(),
});

export type Extracted = z.infer<typeof ExtractedSchema>;

/*
 * Per-chunk Arabic PDF extraction, tried in this order:
 *
 *   1. unpdf — pulls the PDF's embedded text layer. Free, instant. Works on any
 *      digitally-exported Arabic PDF (most modern books, papers, exports).
 *   2. Mistral OCR (`mistral-ocr-latest`) — for scanned pages. ~$1 per 1000
 *      pages, ~30 pages/second, strong on Arabic.
 *   3. Claude vision — legacy fallback, only used when MISTRAL_API_KEY is unset.
 *      Slow (minutes per chunk) and expensive; kept so the app still works
 *      without a Mistral key.
 *
 * The chunking machinery in `lib/texts/extract-job.ts` is unchanged — every
 * chunk just gets read by whichever of the three engines fits.
 */

export async function extractArabicPdf(pdf: Uint8Array): Promise<Extracted> {
  const layer = await tryTextLayer(pdf);
  if (layer) return { title_ar: null, content_ar: layer };

  if (process.env.MISTRAL_API_KEY) {
    return await mistralOcr(pdf);
  }

  return await claudeVision(pdf);
}

/* ─────────────────────── 1. text-layer fast path ─────────────────────── */

async function tryTextLayer(pdf: Uint8Array): Promise<string | null> {
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const doc = await getDocumentProxy(pdf);
    const { text, totalPages } = await extractText(doc, { mergePages: false });
    const joined = text.map((p) => p.trim()).filter(Boolean).join("\n\n");
    if (!isUsableArabicLayer(joined, totalPages)) return null;
    return joined;
  } catch {
    return null;
  }
}

/**
 * A text layer is "usable" when it contains a meaningful amount of Arabic per
 * page (rules out scans) AND is stored in logical Unicode codepoints rather
 * than presentation-form glyphs (rules out broken legacy exports that look
 * like Arabic but are reversed ligature sequences no reader could read back).
 */
function isUsableArabicLayer(text: string, pageCount: number): boolean {
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
  return arabic >= Math.max(1, pageCount) * 100;
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
    // Mistral OCR is fast (≈30 pages/s), but allow generous slack for big
    // chunks + network jitter. The job's own requeue handles transient
    // failures, so no SDK-level retries.
    { retries: { strategy: "none" }, timeoutMs: 120_000 },
  );

  const content = result.pages
    .map((p) => markdownToPlain(p.markdown))
    .filter((s) => s.length > 0)
    .join("\n\n");

  return { title_ar: null, content_ar: content };
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
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ──────────────────── 3. Claude vision (legacy fallback) ──────────────────── */

const CLAUDE_SUBMIT_TOOL = {
  name: "submit_extracted",
  description: "Submit the extracted Arabic reading text from the PDF.",
  input_schema: {
    type: "object",
    properties: {
      title_ar: { type: "string" },
      content_ar: { type: "string" },
    },
    required: ["title_ar", "content_ar"],
  },
} as const;

const CLAUDE_SYSTEM = `You extract Arabic reading text from PDFs. Read pages in order, preserve original wording exactly (no translation, no summarization), keep paragraph breaks, drop page numbers / running headers / footers / branding. Arabic must be in logical Unicode order — never presentation-form ligatures. Submit only via the submit_extracted tool.`;

async function claudeVision(pdf: Uint8Array): Promise<Extracted> {
  const data = Buffer.from(pdf).toString("base64");
  const response = await anthropic.messages.create(
    {
      model: TEST_MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: CLAUDE_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [CLAUDE_SUBMIT_TOOL as never],
      tool_choice: { type: "tool", name: "submit_extracted" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data },
              cache_control: { type: "ephemeral" },
            } as never,
            {
              type: "text",
              text: "Extract the Arabic reading content from this PDF. Submit via the submit_extracted tool.",
            },
          ],
        },
      ],
    },
    { timeout: 240_000, maxRetries: 0 },
  );

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("PDF extraction did not return a tool_use block");
  }
  return ExtractedSchema.parse(toolUse.input);
}
