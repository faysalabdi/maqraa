import { z } from "zod";
import { anthropic, TEST_MODEL } from "./anthropic";

export const ExtractedSchema = z.object({
  title_ar: z.string(),
  content_ar: z.string().min(20),
  chapters: z
    .array(
      z.object({
        title: z.string(),
        section_index: z.number().int().min(0),
      }),
    )
    .optional()
    .default([]),
  quality_note: z.string().optional(),
});

export type Extracted = z.infer<typeof ExtractedSchema>;

const SUBMIT_TOOL = {
  name: "submit_extracted",
  description: "Submit the extracted Arabic reading text from the PDF.",
  input_schema: {
    type: "object",
    properties: {
      title_ar: {
        type: "string",
        description:
          "A short Arabic title for this text. Prefer the document's own title page if present; otherwise compose a 2-5 word Arabic title.",
      },
      content_ar: {
        type: "string",
        description:
          "ALL Arabic reading text from the PDF, in proper logical (Unicode) reading order — exactly as a reader would encounter it. Paragraphs separated by blank lines. Preserve original wording exactly. Drop page numbers, running headers/footers, ISBN/colophon, publisher branding, and any pure-blank pages.",
      },
      chapters: {
        type: "array",
        description:
          "Optional list of chapter boundaries detected in the text. Each entry has the chapter title (Arabic) and the 0-based paragraph index in content_ar where the chapter begins. Leave empty if the document is a single short text with no chaptering.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            section_index: { type: "integer", minimum: 0 },
          },
          required: ["title", "section_index"],
        },
      },
      quality_note: {
        type: "string",
        description:
          "Optional one-sentence note about anything that couldn't be extracted cleanly (e.g. scanned page, diagram, missing tashkeel).",
      },
    },
    required: ["title_ar", "content_ar"],
  },
} as const;

const SYSTEM = `You extract Arabic reading text from PDFs for a language-learning app. You see the PDF directly — pages, layout, typography — and read it the way a human reader would.

Output requirements:
- Arabic text in LOGICAL (Unicode) order. Never output reversed-letter glyphs, presentation-form ligatures, or visual-order strings — only proper Arabic codepoints.
- Preserve the original wording exactly. Do NOT translate, summarize, paraphrase, "correct" grammar, or add tashkeel where the source has none. If a word is misspelled in the original, keep the misspelling.
- Preserve paragraph breaks (double newlines between paragraphs). Single line breaks inside a paragraph should be flattened to spaces unless the text is poetry/verse, in which case keep line breaks.
- Read pages in the order they appear. For multi-column layouts, follow the natural Arabic reading order (right column first).

Include:
- Story / article / lesson body text.
- Quranic verses and hadith (verbatim).
- Vocabulary lists and grammar tables — render as readable Arabic lines.
- Exercise prompts in Arabic.

Drop:
- Page numbers, running headers, running footers, branding (e.g. "arabic.ba"), watermarks, ISBN, publishing colophon.
- Pure-blank pages and table-of-contents pages (they don't add reading material; chapter boundaries should appear in the chapters array instead).
- English UI scraps that snuck in.
- Image captions of decorative images (keep captions of pedagogically-useful images).

Chapters:
- If the book is chaptered (numbered chapters, sections, lessons), populate the chapters array with the chapter title and the paragraph index in content_ar where each chapter starts.
- For a single short text (an article, a single lesson, a flashcard page), leave chapters empty.

Submit only via the submit_extracted tool.`;

// Reads one chunk (a small page range) of a PDF. Big books are split into
// chunks and read by the background extraction job (lib/texts/extract-job.ts),
// which calls this once per chunk.
export async function extractArabicPdf(pdf: Uint8Array): Promise<Extracted> {
  const data = Buffer.from(pdf).toString("base64");

  const response = await anthropic.messages.create(
    {
      model: TEST_MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [SUBMIT_TOOL as never],
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
    // Bound each attempt so a slow call can't blow the invocation budget, but
    // keep one SDK retry so a transient 429/5xx (with the SDK's retry-after
    // backoff) doesn't drop the chunk. Worst case ~2x70s stays under the 300s
    // function limit; chunks that still fail are requeued by the job.
    { timeout: 70_000, maxRetries: 1 },
  );

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("PDF extraction did not return a tool_use block");
  }

  return ExtractedSchema.parse(toolUse.input);
}
