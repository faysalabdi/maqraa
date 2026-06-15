"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

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

  const slug = clean(input.slug);
  if (!slug) throw new Error("slug is required");
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

  revalidatePath("/admin/books");
  revalidatePath("/library");
  return { id: row.id };
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

  revalidatePath("/admin/books");
  revalidatePath("/library");
  revalidatePath(`/book`);
  return { id: row.id };
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

  revalidatePath("/admin/books");
  revalidatePath("/library");
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

  revalidatePath("/admin/books");
}

export async function deleteBook(bookId: string): Promise<void> {
  await requireAdmin();

  // Only allow deleting books no user has interacted with, to avoid orphaning
  // progress, tests, or XP refs.
  const [{ refs }] = await db
    .select({ refs: sql<number>`count(*)` })
    .from(schema.userBooks)
    .where(eq(schema.userBooks.bookId, bookId));
  if (Number(refs) > 0) {
    throw new Error("book has reader progress and cannot be deleted");
  }

  await db.delete(schema.bookChapters).where(eq(schema.bookChapters.bookId, bookId));
  await db.delete(schema.books).where(eq(schema.books.id, bookId));

  revalidatePath("/admin/books");
  revalidatePath("/library");
}
