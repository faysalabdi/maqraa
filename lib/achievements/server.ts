import { and, count, countDistinct, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { grantXp } from "@/lib/xp/grant";
import { SRS_GRADUATED_INTERVAL_DAYS } from "@/lib/srs/sm2";

/**
 * The achievement engine. The `achievements` table + 11 seeded badges already
 * exist; this turns them on by (a) computing progress toward each one from the
 * same sources their criteria reference and (b) awarding + granting XP the
 * moment criteria are met. Idempotent throughout: a badge is written to
 * `user_achievements` once (PK userId+achievementId) and its XP granted once
 * (grantXp refHash).
 */

export type Criteria =
  | { type: "books_completed"; count: number }
  | { type: "tests_passed"; count: number }
  | { type: "perfect_tests"; count: number }
  | { type: "vocab_graduated"; count: number }
  | { type: "vocab_count"; count: number }
  | { type: "streak_days"; count: number }
  | { type: "freeze_used"; count: number }
  | { type: "genre_variety" };

export type AchievementView = {
  slug: string;
  nameEn: string;
  nameAr: string;
  description: string;
  icon: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
  current: number;
  target: number;
  unit: string;
};

type Snapshot = {
  booksCompleted: number;
  testsPassed: number;
  perfectTests: number;
  vocabCount: number;
  vocabGraduated: number;
  longestStreak: number;
  freezesUsed: number;
  genreVariety: number;
};

// "one Islamic book, one novel, one translated work" for the genre-hopper badge.
const REQUIRED_GENRES = ["islamic", "arabic_literature", "translated"] as const;
const STARTING_FREEZES = 2;

async function computeSnapshot(userId: string): Promise<Snapshot> {
  const [booksRows, passedRows, perfectRows, vocabRows, gradRows, streakRows, genreRows] =
    await Promise.all([
      db
        .select({ c: count() })
        .from(schema.userBooks)
        .where(and(eq(schema.userBooks.userId, userId), eq(schema.userBooks.status, "completed"))),
      db
        .select({ c: countDistinct(schema.comprehensionAttempts.bookId) })
        .from(schema.comprehensionAttempts)
        .where(
          and(
            eq(schema.comprehensionAttempts.userId, userId),
            eq(schema.comprehensionAttempts.passed, true),
          ),
        ),
      db
        .select({ c: countDistinct(schema.comprehensionAttempts.bookId) })
        .from(schema.comprehensionAttempts)
        .where(
          and(
            eq(schema.comprehensionAttempts.userId, userId),
            gte(schema.comprehensionAttempts.score, "100"),
          ),
        ),
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(eq(schema.vocabItems.userId, userId)),
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(
          and(
            eq(schema.vocabItems.userId, userId),
            gte(schema.vocabItems.intervalDays, SRS_GRADUATED_INTERVAL_DAYS),
          ),
        ),
      db
        .select({ longest: schema.streaks.longestDays, freezes: schema.streaks.freezesRemaining })
        .from(schema.streaks)
        .where(eq(schema.streaks.userId, userId))
        .limit(1),
      db
        .selectDistinct({ genre: schema.books.genre })
        .from(schema.userBooks)
        .innerJoin(schema.books, eq(schema.userBooks.bookId, schema.books.id))
        .where(and(eq(schema.userBooks.userId, userId), eq(schema.userBooks.status, "completed"))),
    ]);

  const genres = new Set(genreRows.map((g) => g.genre));
  const freezesRemaining = streakRows[0]?.freezes ?? STARTING_FREEZES;

  return {
    booksCompleted: Number(booksRows[0]?.c ?? 0),
    testsPassed: Number(passedRows[0]?.c ?? 0),
    perfectTests: Number(perfectRows[0]?.c ?? 0),
    vocabCount: Number(vocabRows[0]?.c ?? 0),
    vocabGraduated: Number(gradRows[0]?.c ?? 0),
    longestStreak: streakRows[0]?.longest ?? 0,
    freezesUsed: Math.max(0, STARTING_FREEZES - freezesRemaining),
    genreVariety: REQUIRED_GENRES.filter((g) => genres.has(g)).length,
  };
}

function unitFor(criteria: Criteria): string {
  switch (criteria.type) {
    case "books_completed":
      return "books";
    case "tests_passed":
      return "tests";
    case "perfect_tests":
      return "perfect";
    case "vocab_graduated":
      return "mastered";
    case "vocab_count":
      return "words";
    case "streak_days":
      return "days";
    case "genre_variety":
      return "genres";
    case "freeze_used":
      return "";
  }
}

function progressFor(criteria: Criteria, s: Snapshot): { current: number; target: number } {
  switch (criteria.type) {
    case "books_completed":
      return { current: s.booksCompleted, target: criteria.count };
    case "tests_passed":
      return { current: s.testsPassed, target: criteria.count };
    case "perfect_tests":
      return { current: s.perfectTests, target: criteria.count };
    case "vocab_graduated":
      return { current: s.vocabGraduated, target: criteria.count };
    case "vocab_count":
      return { current: s.vocabCount, target: criteria.count };
    case "streak_days":
      return { current: s.longestStreak, target: criteria.count };
    case "freeze_used":
      return { current: s.freezesUsed, target: criteria.count };
    case "genre_variety":
      return { current: s.genreVariety, target: REQUIRED_GENRES.length };
  }
}

/**
 * Award every achievement whose criteria are now met but isn't earned yet.
 * Returns the rows it newly awarded (for a toast). Safe to call on every load.
 */
export async function awardNewAchievements(userId: string): Promise<AchievementView[]> {
  const [allAch, earnedRows, snapshot] = await Promise.all([
    db.select().from(schema.achievements),
    db
      .select({ id: schema.userAchievements.achievementId })
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.userId, userId)),
    computeSnapshot(userId),
  ]);
  const earned = new Set(earnedRows.map((r) => r.id));
  const newly: AchievementView[] = [];

  for (const a of allAch) {
    if (earned.has(a.id)) continue;
    const { current, target } = progressFor(a.criteria as Criteria, snapshot);
    if (current < target) continue;

    const inserted = await db
      .insert(schema.userAchievements)
      .values({ userId, achievementId: a.id })
      .onConflictDoNothing()
      .returning({ id: schema.userAchievements.achievementId });
    if (inserted.length === 0) continue; // already there (raced)

    if (a.xpReward > 0) {
      await grantXp({
        userId,
        delta: a.xpReward,
        reason: "achievement",
        ref: { slug: a.slug },
        refHash: `achievement:${a.slug}`,
      });
    }
    newly.push({
      slug: a.slug,
      nameEn: a.nameEn,
      nameAr: a.nameAr,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      earned: true,
      earnedAt: new Date().toISOString(),
      current: target,
      target,
      unit: unitFor(a.criteria as Criteria),
    });
  }
  return newly;
}

export type AchievementsView = {
  items: AchievementView[];
  earnedCount: number;
  total: number;
  xpEarned: number;
  xpRemaining: number;
};

/** Read-only: every achievement with the user's progress, earned-first. */
export async function loadAchievementsView(userId: string): Promise<AchievementsView> {
  const [allAch, earnedRows, snapshot] = await Promise.all([
    db.select().from(schema.achievements),
    db
      .select()
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.userId, userId)),
    computeSnapshot(userId),
  ]);
  const earnedAtById = new Map(earnedRows.map((r) => [r.achievementId, r.earnedAt]));

  const items: AchievementView[] = allAch
    .map((a) => {
      const { current, target } = progressFor(a.criteria as Criteria, snapshot);
      const at = earnedAtById.get(a.id) ?? null;
      return {
        slug: a.slug,
        nameEn: a.nameEn,
        nameAr: a.nameAr,
        description: a.description,
        icon: a.icon,
        xpReward: a.xpReward,
        earned: at !== null,
        earnedAt: at ? at.toISOString() : null,
        current: Math.min(current, target),
        target,
        unit: unitFor(a.criteria as Criteria),
      };
    })
    .sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      if (a.earned && b.earned) return (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "");
      return b.current / b.target - a.current / a.target;
    });

  const earnedItems = items.filter((i) => i.earned);
  return {
    items,
    earnedCount: earnedItems.length,
    total: items.length,
    xpEarned: earnedItems.reduce((s, i) => s + i.xpReward, 0),
    xpRemaining: items.filter((i) => !i.earned).reduce((s, i) => s + i.xpReward, 0),
  };
}
