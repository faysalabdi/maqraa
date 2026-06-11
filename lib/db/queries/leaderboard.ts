import { db, schema } from "@/lib/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export type LeaderboardScope = "weekly" | "all_time";

export type LeaderboardRow = {
  userId: string;
  displayName: string | null;
  currentLevel: number;
  xp: number; // weekly delta or all-time total depending on scope
};

/** Returns Monday 00:00 UTC for the current week. */
export function weekStart(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat → shift so Monday is the start
  const dow = d.getUTCDay();
  const daysFromMon = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMon);
  return d;
}

export async function getAllTimeLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({
      userId: schema.profiles.id,
      displayName: schema.profiles.displayName,
      currentLevel: schema.profiles.currentLevel,
      xp: schema.profiles.xpTotal,
    })
    .from(schema.profiles)
    .orderBy(desc(schema.profiles.xpTotal))
    .limit(limit);

  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.displayName,
    currentLevel: r.currentLevel,
    xp: r.xp,
  }));
}

export async function getWeeklyLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  const since = weekStart();

  const rows = await db
    .select({
      userId: schema.xpEvents.userId,
      xp: sql<number>`coalesce(sum(${schema.xpEvents.delta}), 0)`,
      displayName: schema.profiles.displayName,
      currentLevel: schema.profiles.currentLevel,
    })
    .from(schema.xpEvents)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.xpEvents.userId))
    .where(gte(schema.xpEvents.occurredAt, since))
    .groupBy(
      schema.xpEvents.userId,
      schema.profiles.displayName,
      schema.profiles.currentLevel,
    )
    .orderBy(desc(sql`sum(${schema.xpEvents.delta})`))
    .limit(limit);

  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.displayName,
    currentLevel: r.currentLevel,
    xp: Number(r.xp),
  }));
}

/**
 * Returns the user's 1-based rank in the given leaderboard, plus their score.
 * `null` if the user has no XP recorded for that scope.
 */
export async function getUserRank(
  userId: string,
  scope: LeaderboardScope,
): Promise<{ rank: number; xp: number } | null> {
  if (scope === "all_time") {
    const [me] = await db
      .select({ xp: schema.profiles.xpTotal })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, userId))
      .limit(1);
    if (!me) return null;

    // Count how many users have strictly more XP.
    const [{ ahead }] = await db
      .select({
        ahead: sql<number>`count(*) filter (where ${schema.profiles.xpTotal} > ${me.xp})`,
      })
      .from(schema.profiles);

    return { rank: Number(ahead) + 1, xp: me.xp };
  }

  // weekly
  const since = weekStart();
  const [meRow] = await db
    .select({
      xp: sql<number>`coalesce(sum(${schema.xpEvents.delta}), 0)`,
    })
    .from(schema.xpEvents)
    .where(
      and(eq(schema.xpEvents.userId, userId), gte(schema.xpEvents.occurredAt, since)),
    );
  const myXp = Number(meRow?.xp ?? 0);
  if (myXp === 0) return null;

  // Subquery: per-user weekly totals
  const totals = db
    .select({
      userId: schema.xpEvents.userId,
      total: sql<number>`sum(${schema.xpEvents.delta})`.as("total"),
    })
    .from(schema.xpEvents)
    .where(gte(schema.xpEvents.occurredAt, since))
    .groupBy(schema.xpEvents.userId)
    .as("totals");

  const [{ ahead }] = await db
    .select({
      ahead: sql<number>`count(*) filter (where ${totals.total} > ${myXp})`,
    })
    .from(totals);

  return { rank: Number(ahead) + 1, xp: myXp };
}
