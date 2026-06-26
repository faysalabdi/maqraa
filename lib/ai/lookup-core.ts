import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

// Shared, env-free lookup primitives so both the app (lib/ai/word-lookup.ts) and
// the offline pre-seed script can reuse the exact prompt/tool/schema.

export const LookupSchema = z.object({
  lemma_ar: z.string(),
  gloss_en: z.string(),
  pos: z.string().nullable().optional(),
  example_ar: z.string().nullable().optional(),
});

export type WordLookup = z.infer<typeof LookupSchema> & { surface: string };

export const LOOKUP_SYSTEM =
  "You are an Arabic-English dictionary for language learners. Given an Arabic word and the sentence it appeared in, return its lemma, a concise contextual English gloss, part of speech, and one simple example sentence. Submit only via the submit_lookup tool.";

export const SUBMIT_LOOKUP_TOOL = {
  name: "submit_lookup",
  description: "Submit the dictionary lookup for the Arabic word.",
  input_schema: {
    type: "object",
    properties: {
      lemma_ar: { type: "string", description: "Dictionary (lemma) form of the word with full tashkeel." },
      gloss_en: { type: "string", description: "Concise English meaning as used in the given context (max 8 words)." },
      pos: { type: ["string", "null"], description: "Part of speech in English (noun, verb form II, particle...)." },
      example_ar: { type: ["string", "null"], description: "One short fully-vocalized Arabic example sentence using the lemma." },
    },
    required: ["lemma_ar", "gloss_en"],
  },
} as const;

/** Run one lookup against Claude. Pure: no cache, no quota, no DB. */
export async function runLookup(
  client: Anthropic,
  model: string,
  surface: string,
  context: string,
): Promise<z.infer<typeof LookupSchema>> {
  const response = await client.messages.create({
    model,
    max_tokens: 500,
    system: [{ type: "text", text: LOOKUP_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_LOOKUP_TOOL as never],
    tool_choice: { type: "tool", name: "submit_lookup" },
    messages: [{ role: "user", content: `Word: ${surface}\nSentence: ${context}` }],
  });
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no tool_use in lookup response");
  return LookupSchema.parse(toolUse.input);
}
