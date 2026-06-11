import { db, schema } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import { generateTest, type GeneratedTest } from "@/lib/ai/test-generator";
import type { PublicQuestion } from "@/server/actions/test-types";

export type FetchOrGenerateResult =
  | {
      ok: true;
      testId: string;
      questions: PublicQuestion[];
      isFallback: boolean;
      passageAr: string;
    }
  | { error: string };

/**
 * Gets an existing comprehension test (reused within 24 h) or generates a new one.
 * Called from Server Components — no "use server" boundary.
 */
export async function fetchOrGenerateTest(
  bookId: string,
  userId: string,
): Promise<FetchOrGenerateResult> {
  // Reuse a test generated within the last 24 h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db
    .select()
    .from(schema.comprehensionTests)
    .where(
      and(
        eq(schema.comprehensionTests.bookId, bookId),
        gte(schema.comprehensionTests.createdAt, cutoff),
      ),
    )
    .orderBy(schema.comprehensionTests.createdAt)
    .limit(1);

  let testRow = existing[0] ?? null;

  if (!testRow) {
    const book = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1)
      .then((r) => r[0]);
    if (!book) return { error: "Book not found" };

    let generated: { test: GeneratedTest; model: string; promptVersion: string };
    try {
      generated = await generateTest({
        titleAr: book.titleAr,
        titleEn: book.titleEn,
        authorEn: book.authorEn,
        level: book.level,
        genre: book.genre,
      });
    } catch (err) {
      console.error("[fetchOrGenerateTest] generateTest failed:", err);
      return { error: "Failed to generate test. Try again." };
    }

    const { test, model, promptVersion } = generated;

    // Store the full test payload (including fallback_passage_ar) in the questions field
    const [inserted] = await db
      .insert(schema.comprehensionTests)
      .values({
        bookId,
        userId,
        model,
        promptVersion,
        questions: {
          questions: test.questions,
          fallback_passage_ar: test.fallback_passage_ar ?? "",
        },
        confidence: test.confidence.toString(),
        isFallback: test.is_fallback,
      })
      .returning();

    testRow = inserted;
  }

  const raw = testRow.questions;
  const stored: { questions: GeneratedTest["questions"]; fallback_passage_ar?: string } =
    Array.isArray(raw)
      ? { questions: raw as GeneratedTest["questions"], fallback_passage_ar: "" }
      : (raw as { questions: GeneratedTest["questions"]; fallback_passage_ar?: string });

  const questions: PublicQuestion[] = stored.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt_ar: q.prompt_ar,
    choices: q.choices,
    vocab_lemma: q.vocab_lemma,
  }));

  return {
    ok: true,
    testId: testRow.id,
    questions,
    isFallback: testRow.isFallback,
    passageAr: stored.fallback_passage_ar ?? "",
  };
}
