import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { lookupKey } from "@/lib/arabic";
import { anthropic, FALLBACK_MODEL } from "./anthropic";

/**
 * Root and pattern analysis for saved words.
 *
 * Batched on purpose: a reader opening this screen has tens of words with no
 * analysis yet, and one request for all of them costs a fraction of one per
 * word. Results are cached globally, so the second reader to save كِتَاب pays
 * nothing.
 */

const RootSchema = z.object({
  lemma_ar: z.string(),
  root: z.string().nullable(),
  pattern: z.string().nullable(),
});
const BatchSchema = z.object({ words: z.array(RootSchema) });

export type RootAnalysis = z.infer<typeof RootSchema>;

const SYSTEM =
  "You are an Arabic morphologist. For each lemma, give its root as space-separated letters (e.g. \"ك ت ب\") and its pattern (wazn) in the فعل convention with tashkeel (e.g. \"فِعَال\", \"فَاعِل\", \"مَفْعَلَة\"). Return root null for a word with no triliteral root, such as a borrowing or a particle. Never guess a root to force a match. Submit only via the submit_roots tool.";

const SUBMIT_ROOTS_TOOL = {
  name: "submit_roots",
  description: "Submit the root and pattern analysis for every lemma given.",
  input_schema: {
    type: "object",
    properties: {
      words: {
        type: "array",
        description: "One entry per lemma, in the order given.",
        items: {
          type: "object",
          properties: {
            lemma_ar: { type: "string", description: "The lemma exactly as supplied." },
            root: {
              type: ["string", "null"],
              description: "Root letters separated by spaces, or null when the word has none.",
            },
            pattern: {
              type: ["string", "null"],
              description: "The wazn with tashkeel, or null when it does not fit a standard pattern.",
            },
          },
          required: ["lemma_ar", "root", "pattern"],
        },
      },
    },
    required: ["words"],
  },
} as const;

/** One batched Claude call. Pure: no cache, no quota, no DB. */
export async function runRootAnalysis(lemmas: string[]): Promise<RootAnalysis[]> {
  if (lemmas.length === 0) return [];
  const response = await anthropic.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_ROOTS_TOOL as never],
    tool_choice: { type: "tool", name: "submit_roots" },
    messages: [{ role: "user", content: lemmas.map((l, i) => `${i + 1}. ${l}`).join("\n") }],
  });
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no tool_use in roots response");
  return BatchSchema.parse(toolUse.input).words;
}

/** Cached root/pattern for these lemmas, keyed by normalised lemma. */
export async function cachedRoots(lemmas: string[]): Promise<Map<string, RootAnalysis>> {
  const keys = [...new Set(lemmas.map((l) => lookupKey(l)).filter(Boolean))];
  if (keys.length === 0) return new Map();
  const rows = await db
    .select()
    .from(schema.wordRoots)
    .where(inArray(schema.wordRoots.key, keys));
  const out = new Map<string, RootAnalysis>();
  for (const row of rows) {
    out.set(row.key, { lemma_ar: row.lemmaAr, root: row.root, pattern: row.pattern });
  }
  return out;
}

/**
 * Analyse whatever is not cached yet and store it.
 *
 * A lemma Claude declines to analyse is still written, with a null root: the
 * point of the row is to stop asking again every time the screen opens.
 */
export async function analyseMissingRoots(lemmas: string[]): Promise<Map<string, RootAnalysis>> {
  const cached = await cachedRoots(lemmas);
  const missing = [...new Set(lemmas.filter((l) => {
    const key = lookupKey(l);
    return key && !cached.has(key);
  }))];
  if (missing.length === 0) return cached;

  const analysed = await runRootAnalysis(missing);
  const byLemma = new Map(analysed.map((a) => [a.lemma_ar, a]));
  const rows = missing.map((lemma) => {
    const found = byLemma.get(lemma);
    return {
      key: lookupKey(lemma),
      lemmaAr: lemma,
      root: found?.root ?? null,
      pattern: found?.pattern ?? null,
    };
  });
  await db.insert(schema.wordRoots).values(rows).onConflictDoNothing();
  for (const row of rows) {
    cached.set(row.key, { lemma_ar: row.lemmaAr, root: row.root, pattern: row.pattern });
  }
  return cached;
}
