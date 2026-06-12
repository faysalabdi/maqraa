import { z } from "zod";
import { anthropic, FALLBACK_MODEL } from "./anthropic";

export const CleanupSchema = z.object({
  cleaned_ar: z.string(),
  quality: z.enum(["good", "partial", "unsalvageable"]),
  notes: z.string().optional(),
});

export type Cleanup = z.infer<typeof CleanupSchema>;

const SUBMIT_TOOL = {
  name: "submit_cleaned_text",
  description: "Submit the cleaned Arabic text from a messy PDF extraction.",
  input_schema: {
    type: "object",
    properties: {
      cleaned_ar: {
        type: "string",
        description:
          "The corrected Arabic text in logical (Unicode) order, with paragraph breaks preserved.",
      },
      quality: {
        type: "string",
        enum: ["good", "partial", "unsalvageable"],
        description:
          "good = fully readable; partial = some sections lost but most usable; unsalvageable = give up.",
      },
      notes: {
        type: "string",
        description: "Optional short note about what was wrong (one sentence).",
      },
    },
    required: ["cleaned_ar", "quality"],
  },
} as const;

const SYSTEM = `You receive raw text extracted from an Arabic PDF. PDF extractors often produce broken Arabic for these specific reasons:

1. REVERSED LETTER ORDER. PDFs store glyphs in visual right-to-left rendering order rather than logical Unicode order, so words come out backwards letter-by-letter. Example: the word "أحمد" (alif-ha-mim-dal) may appear as "دمحأ" (dal-mim-ha-alif). When you see Arabic that reads as gibberish, try reversing each token character-by-character — readable Arabic should appear.
2. PRESENTATION FORMS. Many PDFs embed Arabic Presentation Forms (Unicode U+FB50..U+FEFC and U+FE70..U+FEFC) — precomposed ligated glyphs. These need to be normalized back to base Arabic letters (NFKC normalization).
3. JOINED LAM-ALEF AND SIMILAR LIGATURES. Compound forms like ﻻ should become لا.
4. JUNK. Page headers, footers, page numbers, English UI scraps, and source-website branding may be sprinkled in.

Your job: produce CLEAN ARABIC in proper logical order, suitable for a language learner to read.

Rules:
- Preserve paragraph breaks (double newlines).
- Do NOT translate, paraphrase, summarize, or "improve" the writing. You are a fixer, not an editor — if the original spelling, vocabulary, or grammar is unusual, keep it.
- Drop English/UI cruft (page numbers, footers, "arabic.ba", "Page 1 of N", etc.).
- If you cannot recover a section, omit it rather than guessing wildly.
- If the entire document is unsalvageable, return your best effort and set quality="unsalvageable" with a note.

Submit only via the submit_cleaned_text tool.`;

// Per-chunk upper bound. Larger gives more context but costs more.
const CHUNK_CHARS = 20_000;

function chunk(s: string): string[] {
  if (s.length <= CHUNK_CHARS) return [s];
  const chunks: string[] = [];
  let i = 0;
  while (i < s.length) {
    // Prefer to break on a paragraph boundary.
    let end = Math.min(i + CHUNK_CHARS, s.length);
    if (end < s.length) {
      const nb = s.lastIndexOf("\n\n", end);
      if (nb > i + CHUNK_CHARS / 2) end = nb;
    }
    chunks.push(s.slice(i, end));
    i = end;
  }
  return chunks;
}

export async function cleanupArabicPdfText(raw: string): Promise<Cleanup> {
  // Cheap pre-pass: NFKC normalisation. This already de-ligates many Arabic
  // Presentation Forms and joined lam-alefs back to base Arabic.
  const normalized = raw.normalize("NFKC");

  const pieces = chunk(normalized);
  const results: Cleanup[] = [];

  for (const piece of pieces) {
    const response = await anthropic.messages.create({
      model: FALLBACK_MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [SUBMIT_TOOL as never],
      tool_choice: { type: "tool", name: "submit_cleaned_text" },
      messages: [{ role: "user", content: `Raw extracted text:\n\n${piece}` }],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("PDF cleanup did not return a tool_use block");
    }
    results.push(CleanupSchema.parse(toolUse.input));
  }

  const quality: Cleanup["quality"] = results.some((r) => r.quality === "unsalvageable")
    ? "unsalvageable"
    : results.some((r) => r.quality === "partial")
      ? "partial"
      : "good";

  return {
    cleaned_ar: results.map((r) => r.cleaned_ar.trim()).join("\n\n"),
    quality,
    notes: results
      .map((r) => r.notes)
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * Cheap heuristic: detect that the extracted text is the all-too-common
 * "every word's letters reversed" case. We don't *act* on it (Claude does),
 * but the score can be logged for analytics.
 */
export function looksReversed(s: string): boolean {
  // Common readable Arabic words; if very few appear but their reverses do,
  // the text is probably backwards.
  const common = ["في", "من", "على", "إلى", "ما", "لا", "هو", "هي", "أن", "إن"];
  const reversed = common.map((w) => [...w].reverse().join(""));
  const sample = s.slice(0, 5000);

  let forward = 0;
  let backward = 0;
  for (const w of common) if (sample.includes(w)) forward++;
  for (const w of reversed) if (sample.includes(w)) backward++;

  return backward >= 3 && backward > forward;
}
