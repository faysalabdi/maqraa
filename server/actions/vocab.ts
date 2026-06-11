"use server";

import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { lookupArabicWord, type WordLookup } from "@/lib/ai/word-lookup";
import { rate } from "@/lib/srs/sm2";
import { grantXp } from "@/lib/xp/grant";
import { XP_REWARDS } from "@/lib/xp/rewards";
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
    await grantXp(user.id, 2, "vocab_learned", `word_saved:${lookupKey(lemma)}`);
  }
  return { saved: inserted.length > 0 };
}

export async function rateCard(
  cardId: string,
  quality: number,
): Promise<{ intervalDays: number; strengthChanged: boolean }> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(schema.vocabItems)
    .where(and(eq(schema.vocabItems.id, cardId), eq(schema.vocabItems.userId, user.id)))
    .limit(1);
  const card = rows[0];
  if (!card) throw new Error("card not found");

  const next = rate(
    {
      ease: Number(card.ease),
      intervalDays: card.intervalDays,
      repetitions: card.repetitions,
    },
    quality,
  );

  await db
    .update(schema.vocabItems)
    .set({
      ease: next.ease.toFixed(2),
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
      lastReviewedAt: new Date(),
      lapses: card.lapses + (next.lapsed ? 1 : 0),
    })
    .where(eq(schema.vocabItems.id, cardId));

  await grantXp(user.id, XP_REWARDS.srsReview, "srs_review", `srs:${cardId}:${Date.now()}`);

  return { intervalDays: next.intervalDays, strengthChanged: next.lapsed };
}
