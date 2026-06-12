import { z } from "zod";
import { anthropic, FALLBACK_MODEL } from "./anthropic";

// Many graded-reader pages (e.g. arabic.ba flashcards) carry a single short
// passage of 20-60 Arabic characters. Allow them, but reject obviously empty
// extractions.
export const ExtractedSchema = z.object({
  title: z.string(),
  content_ar: z.string().min(15),
});

export type ExtractedText = z.infer<typeof ExtractedSchema>;

export class ExtractError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage);
  }
}

const SUBMIT_EXTRACTION_TOOL = {
  name: "submit_extraction",
  description: "Submit the extracted Arabic reading text.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short title for the text. Prefer the article's own Arabic title.",
      },
      content_ar: {
        type: "string",
        description:
          "All Arabic reading content from the page, in reading order. Paragraphs separated by blank lines. Keep short passages even if only a few sentences. Drop navigation, ads, comments, share buttons, footers, repeated branding. Do NOT translate or paraphrase.",
      },
    },
    required: ["title", "content_ar"],
  },
} as const;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(p|div|br|h[1-6]|li|tr|hr|article|section)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countArabicChars(s: string): number {
  return (s.match(/[؀-ۿ]/g) ?? []).length;
}

export async function fetchAndExtractArabic(url: string): Promise<ExtractedText> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ExtractError("Only http(s) URLs are supported");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // Browser-like UA — some sites serve a different body to bots.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "ar,en;q=0.8",
      },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
  } catch (e) {
    throw new ExtractError(
      e instanceof Error && e.name === "TimeoutError"
        ? "That page took too long to load"
        : "Could not reach that page",
    );
  }
  if (!res.ok) throw new ExtractError(`Could not fetch the page (HTTP ${res.status})`);

  const raw = (await res.text()).slice(0, 1_500_000);
  const text = stripHtml(raw).slice(0, 60_000);
  const arabicChars = countArabicChars(text);

  if (arabicChars < 10) {
    throw new ExtractError(
      "No Arabic text found on that page. The site may render content with JavaScript, or the Arabic is inside images.",
    );
  }

  const response = await anthropic.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: "You extract Arabic reading text from web pages for a language learner. Return ALL the Arabic reading content (even just a short paragraph or list of sentences from a flashcard-style page). Drop UI chrome, navigation, sidebar links, branding, comments, footer. Keep the text exactly as written — never translate, paraphrase, or add tashkeel. If the page only has a short passage, return that short passage; do not refuse. Submit only via the submit_extraction tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_EXTRACTION_TOOL as never],
    tool_choice: { type: "tool", name: "submit_extraction" },
    messages: [{ role: "user", content: `Source URL: ${url}\n\nPage text:\n${text}` }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new ExtractError("Extraction failed");
  }

  const parsedTool = ExtractedSchema.safeParse(toolUse.input);
  if (!parsedTool.success) {
    // Fallback: if Claude couldn't surface enough, return raw Arabic-heavy
    // lines so the user at least has *something* to read with translations.
    const fallback = text
      .split(/\n+/)
      .filter((line) => countArabicChars(line) > 5)
      .join("\n\n")
      .slice(0, 20_000);
    if (countArabicChars(fallback) < 15) {
      throw new ExtractError(
        "Could not find enough Arabic reading text on that page. Try pasting the text directly instead.",
      );
    }
    return { title: parsed.hostname, content_ar: fallback };
  }

  return parsedTool.data;
}
