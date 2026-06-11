"use server";

import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { lookupArabicWord, type WordLookup } from "@/lib/ai/word-lookup";
import { grantXp, recordActivity } from "@/lib/xp/grant";
import { lookupKey } from "@/lib/arabic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

export async function lookupWord(surface: string, context: string): Promise<WordLookup> {
  await requireUser();
  return lookupArabicWord(surface.slice(0, 50), context.slice(0, 300));
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
