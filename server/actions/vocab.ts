"use server";

import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { count, eq, inArray } from "drizzle-orm";
import { lookupArabicWord, generateLookup, isLookupCached, type WordLookup } from "@/lib/ai/word-lookup";
import { grantXp, recordActivity } from "@/lib/xp/grant";
import { getPlan, FREE } from "@/lib/entitlement";
import { consumeAiQuota } from "@/lib/ai/quota";
import { lookupKey, vocalizedKey } from "@/lib/arabic";
import { COMMON_WORDS } from "@/lib/arabic/common-words";

export type CachedLookup = {
  lemma_ar: string;
  gloss_en: string;
  pos: string | null;
  example_ar: string | null;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

export async function lookupWord(surface: string, context: string): Promise<WordLookup> {
  const user = await requireUser();
  return lookupArabicWord(surface.slice(0, 50), context.slice(0, 300), user.id, user.email);
}

/**
 * Background pre-warm: generate + cache lookups for a chapter's words so taps are
 * instant. Skips common words (served locally) and already-cached words; capped
 * and metered so it can't run up cost. Fire-and-forget from the reader.
 */
export async function prewarmLookups(items: { surface: string; context: string }[]): Promise<void> {
  const user = await requireUser();

  const seen = new Set<string>();
  const cand: { surface: string; context: string }[] = [];
  for (const it of items) {
    const k = lookupKey(it.surface);
    if (!k || COMMON_WORDS[k]) continue;
    const vk = vocalizedKey(it.surface);
    if (seen.has(vk)) continue;
    seen.add(vk);
    cand.push({ surface: it.surface.slice(0, 50), context: it.context.slice(0, 300) });
    if (cand.length >= 40) break;
  }

  const cachedFlags = await Promise.all(cand.map((c) => isLookupCached(c.surface)));
  const queue = cand.filter((_, i) => !cachedFlags[i]).slice(0, 16);

  let stop = false;
  const drain = async () => {
    while (queue.length && !stop) {
      const c = queue.shift()!;
      try {
        await consumeAiQuota(user.id, "prewarm", user.email);
      } catch {
        stop = true;
        return;
      }
      try {
        await generateLookup(c.surface, c.context);
      } catch {
        /* best-effort */
      }
    }
  };
  await Promise.all([drain(), drain(), drain(), drain()]);
}

/**
 * Return the subset of `keys` (vocalized word keys) already in the global lookup
 * cache. Read-only, no Claude — used to warm a chapter so taps on previously-seen
 * words are instant.
 */
export async function cachedLookups(keys: string[]): Promise<Record<string, CachedLookup>> {
  await requireUser();
  const uniq = [...new Set(keys.filter(Boolean))].slice(0, 800);
  if (uniq.length === 0) return {};
  const rows = await db
    .select()
    .from(schema.wordLookups)
    .where(inArray(schema.wordLookups.key, uniq));
  const out: Record<string, CachedLookup> = {};
  for (const r of rows) {
    out[r.key] = { lemma_ar: r.lemmaAr, gloss_en: r.glossEn, pos: r.pos, example_ar: r.exampleAr };
  }
  return out;
}

export async function saveWord(input: {
  lemmaAr: string;
  glossEn: string;
  exampleAr?: string | null;
  bookSlug?: string;
  chapterNumber?: number;
}): Promise<{ saved: boolean }> {
  const user = await requireUser();
  const lemma = input.lemmaAr.trim();
  if (!lemma || !input.glossEn.trim()) throw new Error("invalid word");

  // Free decks are capped; Pro is unlimited. Checked before insert so the cap
  // can't be raced past with parallel saves of new words.
  if ((await getPlan(user.id, user.email)) === "free") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.vocabItems)
      .where(eq(schema.vocabItems.userId, user.id));
    if (Number(n) >= FREE.maxSavedWords) {
      throw new Error(
        `Free saves up to ${FREE.maxSavedWords} words. Upgrade to Pro for an unlimited review deck.`,
      );
    }
  }

  const inserted = await db
    .insert(schema.vocabItems)
    .values({
      userId: user.id,
      lemmaAr: lemma,
      glossEn: input.glossEn.trim(),
      exampleAr: input.exampleAr ?? null,
      source: "reading_flag",
      sourceRef: { bookSlug: input.bookSlug, chapterNumber: input.chapterNumber },
    })
    .onConflictDoNothing()
    .returning({ id: schema.vocabItems.id });

  if (inserted.length > 0) {
    await grantXp({
      userId: user.id,
      delta: 2,
      reason: "vocab_learned",
      refHash: `word_saved:${lookupKey(lemma)}`,
      ref: { bookSlug: input.bookSlug },
    });
    await recordActivity(user.id);
  }
  return { saved: inserted.length > 0 };
}
