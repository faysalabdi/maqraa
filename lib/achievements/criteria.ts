import { db, schema } from "@/lib/db";
import { and, count, eq, gte } from "drizzle-orm";

export type Criteria =
  | { type: "books_completed"; count: number }
  | { type: "tests_passed"; count: number }
  | { type: "vocab_graduated"; count: number }
  | { type: "vocab_count"; count: number }
  | { type: "perfect_tests"; count: number }
  | { type: "streak_days"; count: number }
  | { type: "freeze_used"; count: number }
  | { type: "genre_variety" }
  | { type: "level_book_completed"; level: number }
  | { type: "author_completed"; author_en: string };

const STREAK_INITIAL_FREEZES = 2;

export async function evaluateCriteria(
  criteria: Criteria,
  userId: string,
): Promise<boolean> {
  switch (criteria.type) {
    case "books_completed": {
      const [row] = await db
        .select({ cnt: count() })
        .from(schema.userBooks)
        .where(
          and(
            eq(schema.userBooks.userId, userId),
            eq(schema.userBooks.status, "completed"),
          ),
        );
      return Number(row?.cnt ?? 0) >= criteria.count;
    }

    case "tests_passed": {
      const [row] = await db
        .select({ cnt: count() })
        .from(schema.comprehensionAttempts)
        .where(
          and(
            eq(schema.comprehensionAttempts.userId, userId),
            eq(schema.comprehensionAttempts.passed, true),
          ),
        );
      return Number(row?.cnt ?? 0) >= criteria.count;
    }

    case "vocab_count": {
      const [row] = await db
        .select({ cnt: count() })
        .from(schema.vocabItems)
        .where(eq(schema.vocabItems.userId, userId));
      return Number(row?.cnt ?? 0) >= criteria.count;
    }

    case "vocab_graduated": {
      const [row] = await db
        .select({ cnt: count() })
        .from(schema.vocabItems)
        .where(
          and(
            eq(schema.vocabItems.userId, userId),
            gte(schema.vocabItems.intervalDays, 21),
            eq(schema.vocabItems.lapses, 0),
          ),
        );
      return Number(row?.cnt ?? 0) >= criteria.count;
    }

    case "perfect_tests": {
      const [row] = await db
        .select({ cnt: count() })
        .from(schema.comprehensionAttempts)
        .where(
          and(
            eq(schema.comprehensionAttempts.userId, userId),
            eq(schema.comprehensionAttempts.score, "100"),
          ),
        );
      return Number(row?.cnt ?? 0) >= criteria.count;
    }

    case "streak_days": {
      const [row] = await db
        .select({ longestDays: schema.streaks.longestDays })
        .from(schema.streaks)
        .where(eq(schema.streaks.userId, userId))
        .limit(1);
      return (row?.longestDays ?? 0) >= criteria.count;
    }

    case "freeze_used": {
      const [row] = await db
        .select({ remaining: schema.streaks.freezesRemaining })
        .from(schema.streaks)
        .where(eq(schema.streaks.userId, userId))
        .limit(1);
      const used = STREAK_INITIAL_FREEZES - (row?.remaining ?? STREAK_INITIAL_FREEZES);
      return used >= criteria.count;
    }

    case "genre_variety": {
      const rows = await db
        .select({ genre: schema.books.genre })
        .from(schema.userBooks)
        .innerJoin(schema.books, eq(schema.books.id, schema.userBooks.bookId))
        .where(
          and(
            eq(schema.userBooks.userId, userId),
            eq(schema.userBooks.status, "completed"),
          ),
        );
      const genres = new Set(rows.map((r) => r.genre));
      return genres.size >= 3;
    }

    case "level_book_completed": {
      const rows = await db
        .select({ id: schema.books.id })
        .from(schema.userBooks)
        .innerJoin(schema.books, eq(schema.books.id, schema.userBooks.bookId))
        .where(
          and(
            eq(schema.userBooks.userId, userId),
            eq(schema.userBooks.status, "completed"),
            eq(schema.books.level, criteria.level),
          ),
        )
        .limit(1);
      return rows.length > 0;
    }

    case "author_completed": {
      const rows = await db
        .select({ id: schema.books.id })
        .from(schema.userBooks)
        .innerJoin(schema.books, eq(schema.books.id, schema.userBooks.bookId))
        .where(
          and(
            eq(schema.userBooks.userId, userId),
            eq(schema.userBooks.status, "completed"),
            eq(schema.books.authorEn, criteria.author_en),
          ),
        )
        .limit(1);
      return rows.length > 0;
    }
  }
}
