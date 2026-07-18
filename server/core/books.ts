import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { analyzeBook, type BookAnalysis } from "@/lib/ai/book-analyze";
import { consumeAiQuota } from "@/lib/ai/quota";

export type Uploader = { userId: string; isAdmin: boolean };

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

export type DraftChapterInput = { titleAr: string; titleEn: string; contentAr: string };

function clean(s: string) {
  return s.trim();
}

/**
 * Create a book and all its chapters in one step — the EPUB-upload path. The
 * book is readable immediately since it ships with text.
 */
export async function createBookWithChaptersCore(
  uploader: Uploader,
  input: CreateBookInput,
  chapters: DraftChapterInput[],
): Promise<{ id: string; slug: string; chapters: number }> {
  // Admins add public/curated books; everyone else's uploads are private to them.
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

  return { id: book.id, slug, chapters: cleaned.length };
}

/**
 * Ask Claude to read a sample of the uploaded book and suggest its reading
 * stage, genre, difficulty, a blurb, and cleaned chapter titles. Only excerpts
 * are sent to the model, never the whole book.
 */
export async function analyzeBookDraftCore(
  uploader: Uploader,
  titleHint: string,
  chapters: { titleAr: string; contentAr: string }[],
): Promise<BookAnalysis> {
  if (chapters.length === 0) throw new Error("no chapters to analyze");
  // Admins are unlimited; non-admin uploaders are Pro (resolved by subscription).
  if (!uploader.isAdmin) await consumeAiQuota(uploader.userId, "analyze");
  const sample = chapters
    .map((c) => c.contentAr)
    .join("\n")
    .slice(0, 2000);
  return analyzeBook({
    titleHint,
    sample,
    pages: chapters.map((c) => ({ excerpt: c.contentAr.slice(0, 300) })),
  });
}
