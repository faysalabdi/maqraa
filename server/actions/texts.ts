"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { fetchAndExtractArabic } from "@/lib/ai/extract-text";
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

export async function importTextFromUrl(
  url: string,
): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();

  const existing = await db
    .select({ id: schema.userTexts.id })
    .from(schema.userTexts)
    .where(eq(schema.userTexts.userId, user.id));
  if (existing.length >= MAX_TEXTS_PER_USER) {
    return { error: "You've reached the limit of saved texts. Delete some first." };
  }

  let extracted;
  try {
    extracted = await fetchAndExtractArabic(url.trim());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed" };
  }

  const [row] = await db
    .insert(schema.userTexts)
    .values({
      userId: user.id,
      title: extracted.title.slice(0, 200),
      sourceUrl: url.trim().slice(0, 500),
      contentAr: extracted.content_ar,
      wordCount: countWords(extracted.content_ar),
    })
    .returning({ id: schema.userTexts.id });

  await logEvent("text_imported", { sourceUrl: url, words: countWords(extracted.content_ar) });
  revalidatePath("/texts");
  return { id: row.id };
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

  const [row] = await db
    .insert(schema.userTexts)
    .values({
      userId: user.id,
      title: cleanTitle,
      contentAr: cleanContent,
      wordCount: countWords(cleanContent),
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

/* ───────────────────────────── PDF import ───────────────────────────── */

export async function importTextFromPdf(
  formData: FormData,
): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  if (!(file instanceof File)) return { error: "No file received" };
  if (file.size > 20 * 1024 * 1024) return { error: "PDF too large (max 20 MB)" };

  let raw: string;
  try {
    const { extractText } = await import("unpdf");
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await extractText(buffer, { mergePages: true });
    raw = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  } catch {
    return { error: "Could not read that PDF. Is it a text PDF (not a scan)?" };
  }

  const content = raw
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 500_000);

  if (!/[؀-ۿ]/.test(content)) {
    return {
      error:
        "No Arabic text found. Scanned/image PDFs need OCR first — try exporting a text PDF.",
    };
  }
  if (content.length < 100) return { error: "The PDF contained almost no extractable text" };

  const { sectionize } = await import("@/lib/reading/sections");
  const sections = sectionize(content);

  const [row] = await db
    .insert(schema.userTexts)
    .values({
      userId: user.id,
      title: title || file.name.replace(/\.pdf$/i, ""),
      kind: "pdf",
      contentAr: content,
      wordCount: countWords(content),
      totalSections: sections.length,
    })
    .returning({ id: schema.userTexts.id });

  await logEvent("text_pdf_imported", { sizeBytes: file.size, sections: sections.length });
  revalidatePath("/texts");
  return { id: row.id };
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

  return { correctCount, total: quiz.questions.length, perQuestion, xpEarned };
}
