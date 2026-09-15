import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

// Env-free translation primitives, mirroring lookup-core so the prompt, tool
// and schema have one home.

export const TranslationSchema = z.object({
  translations: z.array(z.string()),
});

export const TRANSLATE_SYSTEM =
  "You translate classical and modern Arabic prose into clear, natural English for language learners. Translate meaning rather than word order: the result should read as English someone would actually write, not as a gloss. Keep each translation to roughly the length of its source, preserve proper nouns, and do not add commentary, notes or bracketed explanations. Return exactly one translation per numbered paragraph, in the same order. Submit only via the submit_translations tool.";

export const SUBMIT_TRANSLATIONS_TOOL = {
  name: "submit_translations",
  description: "Submit the English translations, one per input paragraph, in order.",
  input_schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: { type: "string" },
        description:
          "One natural English translation per numbered input paragraph, in the same order. Same length as the input.",
      },
    },
    required: ["translations"],
  },
} as const;

/** Translate a batch in one call. Pure: no cache, no quota, no DB. */
export async function runTranslate(
  client: Anthropic,
  model: string,
  paragraphs: string[],
): Promise<string[]> {
  if (paragraphs.length === 0) return [];

  const numbered = paragraphs.map((p, i) => `[${i + 1}]\n${p}`).join("\n\n");
  const response = await client.messages.create({
    model,
    // Translations run about the length of their source; this leaves headroom
    // for a full page of Arabic prose without truncating the last paragraph.
    max_tokens: Math.min(8000, 600 + paragraphs.length * 500),
    system: [{ type: "text", text: TRANSLATE_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_TRANSLATIONS_TOOL as never],
    tool_choice: { type: "tool", name: "submit_translations" },
    messages: [
      {
        role: "user",
        content: `Translate these ${paragraphs.length} paragraph(s) into English.\n\n${numbered}`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no tool_use in translate response");
  const { translations } = TranslationSchema.parse(toolUse.input);

  // A short array would silently shift every later paragraph onto the wrong
  // source, so pad rather than misalign.
  if (translations.length < paragraphs.length) {
    return [
      ...translations,
      ...Array(paragraphs.length - translations.length).fill(""),
    ];
  }
  return translations.slice(0, paragraphs.length);
}
