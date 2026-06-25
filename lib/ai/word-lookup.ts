import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, FALLBACK_MODEL } from "./anthropic";
import { lookupKey, vocalizedKey } from "@/lib/arabic";
import { consumeAiQuota } from "./quota";

export const LookupSchema = z.object({
  lemma_ar: z.string(),
  gloss_en: z.string(),
  pos: z.string().nullable().optional(),
  example_ar: z.string().nullable().optional(),
});

export type WordLookup = z.infer<typeof LookupSchema> & { surface: string };

const SUBMIT_LOOKUP_TOOL = {
  name: "submit_lookup",
  description: "Submit the dictionary lookup for the Arabic word.",
  input_schema: {
    type: "object",
    properties: {
      lemma_ar: {
        type: "string",
        description: "Dictionary (lemma) form of the word with full tashkeel.",
      },
      gloss_en: {
        type: "string",
        description: "Concise English meaning as used in the given context (max 8 words).",
      },
      pos: {
        type: ["string", "null"],
        description: "Part of speech in English (noun, verb form II, particle...).",
      },
      example_ar: {
        type: ["string", "null"],
        description: "One short fully-vocalized Arabic example sentence using the lemma.",
      },
    },
    required: ["lemma_ar", "gloss_en"],
  },
} as const;

export async function lookupArabicWord(
  surface: string,
  context: string,
  userId?: string,
): Promise<WordLookup> {
  // Cache on the vocalized form so differently-voweled homographs stay distinct;
  // fall back to the de-diacritized key only to detect "no Arabic letters".
  const key = vocalizedKey(surface);
  if (!lookupKey(surface)) throw new Error("empty word");

  const cached = await db
    .select()
    .from(schema.wordLookups)
    .where(eq(schema.wordLookups.key, key))
    .limit(1);
  if (cached[0]) {
    return {
      surface,
      lemma_ar: cached[0].lemmaAr,
      gloss_en: cached[0].glossEn,
      pos: cached[0].pos,
      example_ar: cached[0].exampleAr,
    };
  }

  // Cache miss = an actual Claude call; meter it against the user's daily quota.
  if (userId) await consumeAiQuota(userId, "lookup");

  const response = await anthropic.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: "You are an Arabic-English dictionary for language learners. Given an Arabic word and the sentence it appeared in, return its lemma, a concise contextual English gloss, part of speech, and one simple example sentence. Submit only via the submit_lookup tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_LOOKUP_TOOL as never],
    tool_choice: { type: "tool", name: "submit_lookup" },
    messages: [
      {
        role: "user",
        content: `Word: ${surface}\nSentence: ${context}`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no tool_use in lookup response");

  const parsed = LookupSchema.parse(toolUse.input);

  await db
    .insert(schema.wordLookups)
    .values({
      key,
      surface,
      lemmaAr: parsed.lemma_ar,
      glossEn: parsed.gloss_en,
      pos: parsed.pos ?? null,
      exampleAr: parsed.example_ar ?? null,
    })
    .onConflictDoNothing();

  return { surface, ...parsed };
}
