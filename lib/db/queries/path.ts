import { db, schema } from "@/lib/db";
import { asc, eq, and } from "drizzle-orm";

export type BookStatus =
  | "locked"
  | "unlocked"
  | "in_progress"
  | "reading_done"
  | "testing"
  | "completed"
  | "failed_retry";

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
  status: BookStatus;
  bestScore: number | null;
  attempts: number;
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

  const userBookMap = new Map<
    string,
    { status: string; bestScore: string | null; attempts: number }
  >();
  if (userId) {
    const rows = await db
      .select()
      .from(schema.userBooks)
      .where(eq(schema.userBooks.userId, userId));
    for (const r of rows) {
      userBookMap.set(r.bookId, {
        status: r.status,
        bestScore: r.bestScore,
        attempts: r.attempts,
      });
    }
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
      .map<BookNodeData>((b) => {
        const ub = userBookMap.get(b.id);
        const status: BookStatus = ub
          ? (ub.status as BookStatus)
          : b.level <= userLevel
            ? "unlocked"
            : "locked";
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
          bestScore: ub?.bestScore ? Number(ub.bestScore) : null,
          attempts: ub?.attempts ?? 0,
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
