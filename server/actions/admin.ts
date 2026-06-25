"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin, requireUploader } from "@/lib/admin";
import { slugify } from "@/lib/utils";
import { analyzeBook, type BookAnalysis } from "@/lib/ai/book-analyze";

export type Genre =
  | "islamic"
  | "arabic_literature"
  | "translated"
  | "graded_reader"
  | "classical";

export type CreateBookInput = {
  slug: string;
  level: number;
  titleAr: string;
  titleEn: string;
  authorAr?: string;
  authorEn?: string;
  blurb: string;
  difficulty: number;
  genre: Genre;
  recommendedPages?: number;
};

function clean(s: string) {
  return s.trim();
}

export async function createBook(input: CreateBookInput): Promise<{ id: string }> {
  await requireAdmin();

  const slug = slugify(input.slug);
  if (!slug)
    throw new Error(
      "slug must contain Latin letters or numbers (e.g. animal-farm) — it becomes part of the book's URL",
    );
  if (!clean(input.titleAr) || !clean(input.titleEn)) throw new Error("title is required");

  const [{ nextOrder }] = await db
    .select({
      nextOrder: sql<number>`coalesce(max(${schema.books.orderInLevel}), -1) + 1`,
    })
    .from(schema.books)
    .where(eq(schema.books.level, input.level));

  const [row] = await db
    .insert(schema.books)
    .values({
      slug,
      level: input.level,
      orderInLevel: nextOrder,
      titleAr: clean(input.titleAr),
      titleEn: clean(input.titleEn),
      authorAr: input.authorAr ? clean(input.authorAr) : null,
      authorEn: input.authorEn ? clean(input.authorEn) : null,
      blurb: clean(input.blurb),
      difficulty: input.difficulty,
      genre: input.genre,
      recommendedPages: input.recommendedPages ?? null,
      // Books created through admin are read in-app, so they start without full
      // text and flip to readable as soon as their first chapter is added.
      hasFullText: false,
    })
    .returning({ id: schema.books.id });

  revalidatePath("/upload");
  revalidatePath("/path");
  return { id: row.id };
}

export type DraftChapterInput = { titleAr: string; titleEn: string; contentAr: string };

/**
 * Create a book and all its chapters in one step — the EPUB-upload path. The
 * book is readable immediately since it ships with text.
 */
export async function createBookWithChapters(
  input: CreateBookInput,
  chapters: DraftChapterInput[],
): Promise<{ id: string; slug: string; chapters: number }> {
  // Admins add public/curated books; everyone else's uploads are private to them.
  const uploader = await requireUploader();
  const ownerId = uploader.isAdmin ? null : uploader.userId;

  const slug = slugify(input.slug);
  if (!slug)
    throw new Error("slug must contain Latin letters or numbers (e.g. animal-farm)");
  if (!clean(input.titleAr) || !clean(input.titleEn)) throw new Error("title is required");

  const cleaned = chapters
    .map((c) => ({
      titleAr: clean(c.titleAr),
      titleEn: clean(c.titleEn),
      contentAr: c.contentAr.trim(),
    }))
    .filter((c) => c.contentAr.length > 0);
  if (cleaned.length === 0) throw new Error("no chapters to add");

  const [existing] = await db
    .select({ id: schema.books.id })
    .from(schema.books)
    .where(eq(schema.books.slug, slug))
    .limit(1);
  if (existing) throw new Error(`a book with slug "${slug}" already exists — pick another slug`);

  const [{ nextOrder }] = await db
    .select({ nextOrder: sql<number>`coalesce(max(${schema.books.orderInLevel}), -1) + 1` })
    .from(schema.books)
    .where(eq(schema.books.level, input.level));

  const [book] = await db
    .insert(schema.books)
    .values({
      slug,
      level: input.level,
      orderInLevel: nextOrder,
      titleAr: clean(input.titleAr),
      titleEn: clean(input.titleEn),
      authorAr: input.authorAr ? clean(input.authorAr) : null,
      authorEn: input.authorEn ? clean(input.authorEn) : null,
      blurb: clean(input.blurb),
      difficulty: input.difficulty,
      genre: input.genre,
      recommendedPages: input.recommendedPages ?? null,
      hasFullText: true,
      ownerId,
    })
    .returning({ id: schema.books.id });

  await db.insert(schema.bookChapters).values(
    cleaned.map((c, i) => ({
      bookId: book.id,
      chapterNumber: i + 1,
      titleAr: c.titleAr || `الفصل ${i + 1}`,
      titleEn: c.titleEn || `Chapter ${i + 1}`,
      contentAr: c.contentAr,
      source: "public_domain" as const,
    })),
  );

  revalidatePath("/upload");
  revalidatePath("/path");
  return { id: book.id, slug, chapters: cleaned.length };
}

/**
 * Ask Claude to read a sample of the uploaded book and suggest its reading
 * stage, genre, difficulty, a blurb, and cleaned chapter titles. Only excerpts
 * are sent to the model, never the whole book.
 */
export async function analyzeBookDraft(
  titleHint: string,
  chapters: { titleAr: string; contentAr: string }[],
): Promise<BookAnalysis> {
  await requireUploader();
  if (chapters.length === 0) throw new Error("no chapters to analyze");
  const sample = chapters
    .map((c) => c.contentAr)
    .join("\n")
    .slice(0, 2000);
  return analyzeBook({
    titleHint,
    sample,
    chapters: chapters.map((c) => ({ title: c.titleAr, excerpt: c.contentAr.slice(0, 200) })),
  });
}

export type AddChapterInput = {
  bookId: string;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  source?: "public_domain" | "original";
};

export async function addChapter(input: AddChapterInput): Promise<{ id: string }> {
  await requireAdmin();

  if (!clean(input.contentAr)) throw new Error("chapter text is required");
  if (!clean(input.titleAr) || !clean(input.titleEn)) throw new Error("chapter title is required");

  const [{ nextNumber }] = await db
    .select({
      nextNumber: sql<number>`coalesce(max(${schema.bookChapters.chapterNumber}), 0) + 1`,
    })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.bookId, input.bookId));

  const [row] = await db
    .insert(schema.bookChapters)
    .values({
      bookId: input.bookId,
      chapterNumber: nextNumber,
      titleAr: clean(input.titleAr),
      titleEn: clean(input.titleEn),
      contentAr: input.contentAr.trim(),
      source: input.source ?? "public_domain",
    })
    .returning({ id: schema.bookChapters.id });

  // A book with at least one chapter is readable in-app.
  await db
    .update(schema.books)
    .set({ hasFullText: true })
    .where(eq(schema.books.id, input.bookId));

  revalidatePath("/upload");
  revalidatePath("/path");
  revalidatePath(`/book`);
  return { id: row.id };
}

export async function addChapters(
  bookId: string,
  chapters: { titleAr: string; titleEn: string; contentAr: string }[],
): Promise<{ count: number }> {
  await requireAdmin();

  const cleaned = chapters
    .map((c) => ({
      titleAr: clean(c.titleAr),
      titleEn: clean(c.titleEn),
      contentAr: c.contentAr.trim(),
    }))
    .filter((c) => c.contentAr.length > 0);
  if (cleaned.length === 0) throw new Error("no chapters to add");

  const [{ start }] = await db
    .select({ start: sql<number>`coalesce(max(${schema.bookChapters.chapterNumber}), 0)` })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.bookId, bookId));
  const base = Number(start);

  await db.insert(schema.bookChapters).values(
    cleaned.map((c, i) => ({
      bookId,
      chapterNumber: base + i + 1,
      titleAr: c.titleAr || `الفصل ${base + i + 1}`,
      titleEn: c.titleEn || `Chapter ${base + i + 1}`,
      contentAr: c.contentAr,
      source: "public_domain" as const,
    })),
  );

  await db.update(schema.books).set({ hasFullText: true }).where(eq(schema.books.id, bookId));

  revalidatePath("/upload");
  revalidatePath("/path");
  return { count: cleaned.length };
}

export async function deleteChapter(chapterId: string, bookId: string): Promise<void> {
  await requireAdmin();

  await db.delete(schema.bookChapters).where(eq(schema.bookChapters.id, chapterId));

  // If that was the last chapter, the book is no longer readable in-app.
  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)` })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.bookId, bookId));
  if (Number(remaining) === 0) {
    await db.update(schema.books).set({ hasFullText: false }).where(eq(schema.books.id, bookId));
  }

  revalidatePath("/upload");
  revalidatePath("/path");
}

export async function updateChapter(input: {
  chapterId: string;
  titleAr: string;
  titleEn: string;
  contentAr: string;
}): Promise<void> {
  await requireAdmin();
  if (!clean(input.contentAr)) throw new Error("chapter text is required");

  await db
    .update(schema.bookChapters)
    .set({
      titleAr: clean(input.titleAr),
      titleEn: clean(input.titleEn),
      contentAr: input.contentAr.trim(),
    })
    .where(eq(schema.bookChapters.id, input.chapterId));

  revalidatePath("/upload");
}

export async function deleteBook(bookId: string): Promise<void> {
  const uploader = await requireUploader();

  const [book] = await db
    .select({ id: schema.books.id, ownerId: schema.books.ownerId })
    .from(schema.books)
    .where(eq(schema.books.id, bookId))
    .limit(1);
  if (!book) return;
  // Admins delete any book; everyone else only their own uploads.
  if (!uploader.isAdmin && book.ownerId !== uploader.userId) throw new Error("forbidden");

  // Cascade: remove everything that references the book or its chapters, then
  // the book. (XP events keep a loose jsonb ref with no FK — left alone.)
  const chapterRows = await db
    .select({ id: schema.bookChapters.id })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.bookId, bookId));
  const chapterIds = chapterRows.map((c) => c.id);

  await db
    .delete(schema.comprehensionAttempts)
    .where(eq(schema.comprehensionAttempts.bookId, bookId));
  await db.delete(schema.comprehensionTests).where(eq(schema.comprehensionTests.bookId, bookId));
  await db.delete(schema.readingSessions).where(eq(schema.readingSessions.bookId, bookId));
  await db.delete(schema.userBooks).where(eq(schema.userBooks.bookId, bookId));
  if (chapterIds.length > 0) {
    await db
      .delete(schema.userChapterProgress)
      .where(inArray(schema.userChapterProgress.chapterId, chapterIds));
    await db
      .delete(schema.chapterQuizzes)
      .where(inArray(schema.chapterQuizzes.chapterId, chapterIds));
  }
  await db.delete(schema.bookChapters).where(eq(schema.bookChapters.bookId, bookId));
  await db.delete(schema.books).where(eq(schema.books.id, bookId));

  revalidatePath("/upload");
  revalidatePath("/path");
}
