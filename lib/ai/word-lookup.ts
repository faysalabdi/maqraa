import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, FALLBACK_MODEL } from "./anthropic";
import { lookupKey, vocalizedKey } from "@/lib/arabic";
import { consumeAiQuota } from "./quota";
import { runLookup, type WordLookup } from "./lookup-core";

export type { WordLookup } from "./lookup-core";

/** True if this word is already in the global cache (no Claude call). */
export async function isLookupCached(surface: string): Promise<boolean> {
  const [row] = await db
    .select({ key: schema.wordLookups.key })
    .from(schema.wordLookups)
    .where(eq(schema.wordLookups.key, vocalizedKey(surface)))
    .limit(1);
  return !!row;
}

/** Generate a lookup via Claude and cache it. No cache check, no quota. */
export async function generateLookup(surface: string, context: string): Promise<WordLookup> {
  const key = vocalizedKey(surface);
  const parsed = await runLookup(anthropic, FALLBACK_MODEL, surface, context);
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

export async function lookupArabicWord(
  surface: string,
  context: string,
  userId?: string,
  email?: string | null,
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
  if (userId) await consumeAiQuota(userId, "lookup", email);
  return generateLookup(surface, context);
}
