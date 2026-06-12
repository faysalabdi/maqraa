"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { logEvent } from "@/lib/analytics";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

const MAX_TEXTS_PER_USER = 200;

async function userLevel(userId: string): Promise<number> {
  const [profile] = await db
    .select({ currentLevel: schema.profiles.currentLevel })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId))
    .limit(1);
  return profile?.currentLevel ?? 1;
}

export async function importTextFromPaste(
  title: string,
  content: string,
): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();

  const cleanTitle = title.trim().slice(0, 200);
  const cleanContent = content.trim().slice(0, 200_000);
  if (!cleanTitle) return { error: "Give the text a title" };
  if (cleanContent.length < 40) return { error: "Text is too short" };
  if (!/[؀-ۿ]/.test(cleanContent)) return { error: "That doesn't look like Arabic text" };

  const { sectionize } = await import("@/lib/reading/sections");
  const sections = sectionize(cleanContent);
  const level = await userLevel(user.id);

  const [row] = await db
    .insert(schema.userTexts)
    .values({
      userId: user.id,
      title: cleanTitle,
      level,
      contentAr: cleanContent,
      wordCount: countWords(cleanContent),
      totalSections: sections.length,
    })
    .returning({ id: schema.userTexts.id });

  await logEvent("text_pasted", { words: countWords(cleanContent) });
  revalidatePath("/texts");
  return { id: row.id };
}

export async function deleteText(id: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(schema.userTexts)
    .where(and(eq(schema.userTexts.id, id), eq(schema.userTexts.userId, user.id)));
  revalidatePath("/texts");
}

export async function touchTextRead(id: string): Promise<void> {
  const user = await requireUser();
  await db
    .update(schema.userTexts)
    .set({ lastReadAt: new Date() })
    .where(and(eq(schema.userTexts.id, id), eq(schema.userTexts.userId, user.id)));
}

/* ───────────────────────────── PDF import ─────────────────────────────
 *
 * Strategy: send the PDF directly to Claude as a document content block.
 * Claude renders each page visually and reads it like a human, so we avoid
 * every Arabic-PDF-extraction failure mode at once — reversed glyph order,
 * presentation-form ligatures, broken text spans across columns, hidden font
 * encodings.
 *
 * Upload path: the browser uploads the PDF straight to the private
 * `pdf_imports` Supabase Storage bucket (Vercel rejects request bodies over
 * ~4.5 MB, so the file can't travel through a server action). The action below
 * receives only the storage path, downloads the file with the service role,
 * splits it into small page-range chunks, deletes the upload, and queues the
 * chunks for BACKGROUND extraction: the import returns an id immediately with
 * status "processing" and a self-chaining route reads the chunks a few at a
 * time. The reader shows extracted text as it lands, so the user starts
 * reading before the whole book is done and a 600-page book never blocks (or
 * times out) a single request.
 */

export async function importTextFromStorage(
  storagePath: string,
  title: string,
  originalFileName?: string,
): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();

  // Users can only import objects from their own uid/ folder.
  if (!storagePath.startsWith(`${user.id}/`) || storagePath.includes("..")) {
    return { error: "Invalid upload path" };
  }
  title = title.trim().slice(0, 200);

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const storage = admin.storage.from("pdf_imports");

  const { data: blob, error: dlError } = await storage.download(storagePath);
  if (dlError || !blob) {
    console.error("[importTextFromStorage] download failed:", dlError?.message);
    return {
      error:
        "Could not fetch your upload from storage. If this persists, run db/migrations/0004_pdf_imports_bucket.sql in the Supabase SQL editor.",
    };
  }
  if (blob.size > 20 * 1024 * 1024) {
    await storage.remove([storagePath]);
    return { error: "PDF too large (max 20 MB)" };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  // The storage key is a synthetic uuid (storage rejects non-ASCII keys), so
  // the real filename — often Arabic — travels as a separate argument.
  const fileName =
    originalFileName?.trim().slice(0, 200) || storagePath.split("/").pop() || "import.pdf";

  const { PAGES_PER_CHUNK, MAX_PAGES, triggerExtraction } = await import(
    "@/lib/texts/extract-job"
  );

  // Split into chunks now (fast, no AI). The slow vision reads happen later.
  let chunks: { index: number; start: number; end: number; base64: string }[];
  let pageCount: number;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = source.getPageCount();
    if (pageCount > MAX_PAGES) {
      await storage.remove([storagePath]);
      return {
        error: `This PDF has ${pageCount} pages — the current limit is ${MAX_PAGES}. Split it and import in parts.`,
      };
    }

    chunks = [];
    for (let start = 0; start < pageCount; start += PAGES_PER_CHUNK) {
      const end = Math.min(start + PAGES_PER_CHUNK, pageCount);
      const part = await PDFDocument.create();
      const pages = await part.copyPages(
        source,
        Array.from({ length: end - start }, (_, i) => start + i),
      );
      for (const page of pages) part.addPage(page);
      const partBytes = await part.save();
      chunks.push({
        index: chunks.length,
        start,
        end,
        base64: Buffer.from(partBytes).toString("base64"),
      });
    }
  } catch {
    await storage.remove([storagePath]);
    return { error: "That PDF could not be read — is it a valid PDF file?" };
  }

  if (chunks.length === 0) {
    await storage.remove([storagePath]);
    return { error: "That PDF has no pages" };
  }

  let textRowId: string;
  try {
    const [row] = await db
      .insert(schema.userTexts)
      .values({
        userId: user.id,
        title: title || fileName.replace(/\.pdf$/i, ""),
        kind: "pdf",
        level: await userLevel(user.id),
        contentAr: "",
        wordCount: 0,
        totalSections: 1,
        extractionStatus: "processing",
        pagesTotal: pageCount,
        pagesDone: 0,
      })
      .returning({ id: schema.userTexts.id });
    textRowId = row.id;

    // Insert chunk rows in small batches — a 20 MB book is ~27 MB of base64,
    // too much for one statement through the connection pooler.
    const BATCH = 5;
    for (let i = 0; i < chunks.length; i += BATCH) {
      await db.insert(schema.textChunks).values(
        chunks.slice(i, i + BATCH).map((c) => ({
          textId: textRowId,
          chunkIndex: c.index,
          pageStart: c.start,
          pageEnd: c.end,
          pdfBase64: c.base64,
        })),
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[importTextFromStorage] db write failed:", msg);
    if (/extraction_status|text_chunks|pages_total|pages_done/i.test(msg)) {
      return {
        error:
          "Database is missing migration 0003 (background PDF extraction). Run db/migrations/0003_background_pdf_extraction.sql in the Supabase SQL editor, then retry.",
      };
    }
    return { error: "Could not save the PDF — try again in a moment." };
  }

  // The chunks are in Postgres now; the original upload is no longer needed.
  await storage.remove([storagePath]);

  await logEvent("text_pdf_imported", {
    sizeBytes: blob.size,
    pages: pageCount,
    chunks: chunks.length,
  });

  // Kick off background extraction after this response is flushed.
  after(() => triggerExtraction(textRowId));

  revalidatePath("/texts");
  return { id: textRowId };
}

/** Resume a stalled or failed PDF extraction. */
export async function retryTextExtraction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();

  const [text] = await db
    .select()
    .from(schema.userTexts)
    .where(and(eq(schema.userTexts.id, id), eq(schema.userTexts.userId, user.id)))
    .limit(1);
  if (!text) return { error: "Text not found" };
  if (text.extractionStatus === "ready") return { ok: true };

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(schema.textChunks)
    .where(eq(schema.textChunks.textId, id));
  if (Number(cnt) === 0) {
    return { error: "Nothing left to extract — please re-import this PDF." };
  }

  // Requeue anything that didn't finish cleanly.
  await db
    .update(schema.textChunks)
    .set({ status: "pending" })
    .where(
      and(
        eq(schema.textChunks.textId, id),
        inArray(schema.textChunks.status, ["working", "failed"]),
      ),
    );

  await db
    .update(schema.userTexts)
    .set({ extractionStatus: "processing", extractionError: null })
    .where(eq(schema.userTexts.id, id));

  const { triggerExtraction } = await import("@/lib/texts/extract-job");
  after(() => triggerExtraction(id));

  revalidatePath(`/texts/${id}`);
  revalidatePath("/texts");
  return { ok: true };
}

/* ─────────────────────────── story generation ─────────────────────────── */

export async function generateStoryText(
  topicHint?: string,
): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();

  const profile = await db
    .select({ currentLevel: schema.profiles.currentLevel })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);
  const level = profile[0]?.currentLevel ?? 1;

  let story;
  try {
    const { generateStory } = await import("@/lib/ai/story-generator");
    story = await generateStory({ level, topicHint });
  } catch {
    return { error: "Story generation failed — try again" };
  }

  const { sectionize } = await import("@/lib/reading/sections");
  const sections = sectionize(story.content_ar);

  const [row] = await db
    .insert(schema.userTexts)
    .values({
      userId: user.id,
      title: story.title_ar,
      kind: "generated",
      level,
      contentAr: story.content_ar,
      wordCount: countWords(story.content_ar),
      totalSections: sections.length,
    })
    .returning({ id: schema.userTexts.id });

  await logEvent("story_generated", { level, words: countWords(story.content_ar) });
  revalidatePath("/texts");
  return { id: row.id };
}

/* ──────────────────────── progress + section quizzes ──────────────────────── */

export async function updateTextProgress(id: string, currentSection: number): Promise<void> {
  const user = await requireUser();
  await db
    .update(schema.userTexts)
    .set({ currentSection: Math.max(0, currentSection), lastReadAt: new Date() })
    .where(and(eq(schema.userTexts.id, id), eq(schema.userTexts.userId, user.id)));
}

export type TextSectionQuiz = {
  questions: { id: string; prompt_ar: string; choices: string[] }[];
};

export async function getTextSectionQuiz(
  textId: string,
  sectionNumber: number,
): Promise<TextSectionQuiz> {
  const user = await requireUser();

  const [text] = await db
    .select()
    .from(schema.userTexts)
    .where(and(eq(schema.userTexts.id, textId), eq(schema.userTexts.userId, user.id)))
    .limit(1);
  if (!text) throw new Error("text not found");

  const cached = await db
    .select()
    .from(schema.textQuizzes)
    .where(
      and(
        eq(schema.textQuizzes.textId, textId),
        eq(schema.textQuizzes.sectionNumber, sectionNumber),
      ),
    )
    .limit(1);

  const { ChapterQuizSchema, generateQuizForContent } = await import("@/lib/ai/chapter-quiz");

  let quiz;
  if (cached[0]) {
    quiz = ChapterQuizSchema.parse(cached[0].questions);
  } else {
    const { sectionize, sectionText } = await import("@/lib/reading/sections");
    const sections = sectionize(text.contentAr);
    const section = sections[sectionNumber];
    if (!section) throw new Error("section not found");

    const profile = await db
      .select({ currentLevel: schema.profiles.currentLevel })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1);

    quiz = await generateQuizForContent(
      sectionText(section),
      text.level ?? profile[0]?.currentLevel ?? 1,
    );
    await db
      .insert(schema.textQuizzes)
      .values({ textId, sectionNumber, questions: quiz, model: "haiku" })
      .onConflictDoNothing();
  }

  return {
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt_ar: q.prompt_ar,
      choices: q.choices,
    })),
  };
}

export type TextSectionResult = {
  correctCount: number;
  total: number;
  perQuestion: { id: string; correct: boolean; answerIndex: number; rationaleAr: string }[];
  xpEarned: number;
  textFinished: boolean;
};

export async function submitTextSectionQuiz(
  textId: string,
  sectionNumber: number,
  answers: Record<string, number>,
): Promise<TextSectionResult> {
  const user = await requireUser();

  const [text] = await db
    .select()
    .from(schema.userTexts)
    .where(and(eq(schema.userTexts.id, textId), eq(schema.userTexts.userId, user.id)))
    .limit(1);
  if (!text) throw new Error("text not found");

  const cached = await db
    .select()
    .from(schema.textQuizzes)
    .where(
      and(
        eq(schema.textQuizzes.textId, textId),
        eq(schema.textQuizzes.sectionNumber, sectionNumber),
      ),
    )
    .limit(1);
  if (!cached[0]) throw new Error("quiz not generated");

  const { ChapterQuizSchema } = await import("@/lib/ai/chapter-quiz");
  const quiz = ChapterQuizSchema.parse(cached[0].questions);

  const perQuestion = quiz.questions.map((q) => ({
    id: q.id,
    correct: answers[q.id] === q.answer_index,
    answerIndex: q.answer_index,
    rationaleAr: q.rationale_ar,
  }));
  const correctCount = perQuestion.filter((p) => p.correct).length;

  const completed = new Set<number>(
    Array.isArray(text.completedSections) ? (text.completedSections as number[]) : [],
  );
  completed.add(sectionNumber);

  await db
    .update(schema.userTexts)
    .set({
      completedSections: [...completed].sort((a, b) => a - b),
      lastReadAt: new Date(),
    })
    .where(eq(schema.userTexts.id, textId));

  const { grantXp, recordActivity } = await import("@/lib/xp/grant");
  let xpEarned = 0;
  if (correctCount >= 2) {
    xpEarned = await grantXp({
      userId: user.id,
      delta: correctCount === quiz.questions.length ? 20 : 12,
      reason: "page_logged",
      ref: { textId, sectionNumber, correctCount },
      refHash: `text_section:${textId}:${sectionNumber}`,
    });
    await recordActivity(user.id);
  }

  // Finishing every section of a text counts like finishing a book: it earns
  // book-completion XP (scaled to length) and pushes the path forward. Skip
  // this while a PDF is still extracting — "all sections" is only the prefix
  // read so far, not the whole book.
  let textFinished = false;
  if (
    text.extractionStatus === "ready" &&
    text.totalSections > 0 &&
    completed.size >= text.totalSections
  ) {
    textFinished = true;
    const { bookCompletionXp } = await import("@/lib/xp/rewards");
    const completionXp = bookCompletionXp(text.wordCount);
    if (completionXp > 0) {
      xpEarned += await grantXp({
        userId: user.id,
        delta: completionXp,
        reason: "book_completed",
        ref: { textId, kind: text.kind },
        refHash: `text_completed:${textId}`,
      });
    }
    const { maybeLevelUp } = await import("@/lib/progression");
    const level = text.level ?? (await userLevel(user.id));
    await maybeLevelUp(user.id, level);
    revalidatePath("/path");
  }

  return { correctCount, total: quiz.questions.length, perQuestion, xpEarned, textFinished };
}

/** Manually re-assign a text's difficulty level (1-8). */
export async function setTextLevel(
  id: string,
  level: number,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const clean = Math.round(level);
  if (clean < 1 || clean > 8) return { error: "Level must be 1-8" };

  await db
    .update(schema.userTexts)
    .set({ level: clean })
    .where(and(eq(schema.userTexts.id, id), eq(schema.userTexts.userId, user.id)));

  revalidatePath("/texts");
  return { ok: true };
}
