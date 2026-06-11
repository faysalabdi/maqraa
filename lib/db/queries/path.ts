import { db, schema } from "@/lib/db";
import { asc, eq, and } from "drizzle-orm";

export type BookNodeData = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  authorEn: string | null;
  level: number;
  orderInLevel: number;
  genre: string;
  difficulty: number;
  recommendedPages: number | null;
  hasFullText: boolean;
  status: "locked" | "unlocked" | "in_progress" | "reading_done" | "testing" | "completed";
};

export type LevelData = {
  level: number;
  slug: string;
  nameEn: string;
  nameAr: string;
  description: string;
  booksRequiredToClear: number;
  books: BookNodeData[];
};

export async function getPathForUser(
  userId: string | null,
  userLevel: number = 1,
): Promise<LevelData[]> {
  const levels = await db.select().from(schema.levels).orderBy(asc(schema.levels.level));
  const books = await db
    .select()
    .from(schema.books)
    .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel));

  const userBookMap = new Map<string, string>(); // bookId -> status
  if (userId) {
    const rows = await db
      .select()
      .from(schema.userBooks)
      .where(eq(schema.userBooks.userId, userId));
    for (const r of rows) userBookMap.set(r.bookId, r.status);
  }

  return levels.map((lv) => ({
    level: lv.level,
    slug: lv.slug,
    nameEn: lv.nameEn,
    nameAr: lv.nameAr,
    description: lv.description,
    booksRequiredToClear: lv.booksRequiredToClear,
    books: books
      .filter((b) => b.level === lv.level)
      .map((b) => {
        const stored = userBookMap.get(b.id);
        let status: BookNodeData["status"];
        if (stored) {
          status = stored as BookNodeData["status"];
        } else if (b.level <= userLevel) {
          status = "unlocked";
        } else {
          status = "locked";
        }
        return {
          id: b.id,
          slug: b.slug,
          titleAr: b.titleAr,
          titleEn: b.titleEn,
          authorEn: b.authorEn,
          level: b.level,
          orderInLevel: b.orderInLevel,
          genre: b.genre,
          difficulty: b.difficulty,
          recommendedPages: b.recommendedPages,
          hasFullText: b.hasFullText,
          status,
        };
      }),
  }));
}

export async function getBookBySlug(slug: string) {
  const rows = await db.select().from(schema.books).where(eq(schema.books.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getUserBook(userId: string, bookId: string) {
  const rows = await db
    .select()
    .from(schema.userBooks)
    .where(and(eq(schema.userBooks.userId, userId), eq(schema.userBooks.bookId, bookId)))
    .limit(1);
  return rows[0] ?? null;
}
