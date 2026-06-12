import { z } from "zod";
import { anthropic, FALLBACK_MODEL } from "./anthropic";

export const ExtractedSchema = z.object({
  title: z.string(),
  content_ar: z.string().min(40),
});

export type ExtractedText = z.infer<typeof ExtractedSchema>;

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
          "The main Arabic body text only, cleaned. Paragraphs separated by blank lines. No navigation, ads, comments, or English UI text.",
      },
    },
    required: ["title", "content_ar"],
  },
} as const;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(p|div|br|h[1-6]|li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchAndExtractArabic(url: string): Promise<ExtractedText> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) URLs are supported");
  }

  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; arabic-xp/1.0)" },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not fetch the page (HTTP ${res.status})`);

  const raw = (await res.text()).slice(0, 1_500_000);
  const text = stripHtml(raw).slice(0, 40_000);

  if (!/[؀-ۿ]/.test(text)) {
    throw new Error("No Arabic text found on that page");
  }

  const response = await anthropic.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: "You extract the main Arabic reading text from messy web-page content for a language learner's personal reading list. Return the article/story body only — drop navigation, menus, ads, comments, share buttons, footers, and unrelated snippets. Keep the Arabic exactly as written (do not rewrite, summarize, or add tashkeel). Preserve paragraph breaks. If multiple stories are on the page, pick the main/longest one. Submit only via the submit_extraction tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_EXTRACTION_TOOL as never],
    tool_choice: { type: "tool", name: "submit_extraction" },
    messages: [{ role: "user", content: `Source URL: ${url}\n\nPage text:\n${text}` }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Extraction failed");

  return ExtractedSchema.parse(toolUse.input);
}
