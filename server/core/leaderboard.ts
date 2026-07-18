import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { CoreUser } from "./user";

export type LeaderRow = {
  userId: string;
  name: string;
  avatar: string | null;
  xp: number;
  streak: number;
  isYou: boolean;
};

export type LeaderboardResponse = {
  scope: "week" | "all";
  rows: LeaderRow[];
  you: (LeaderRow & { rank: number }) | null;
};

function startOfWeekISO(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday.toISOString();
}

function displayName(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "Reader";
  // Show first name + last initial, never the full email/handle.
  const base = n.split("@")[0];
  const parts = base.split(/[.\s_]+/).filter(Boolean);
  if (parts.length >= 2) return `${cap(parts[0])} ${parts[1][0].toUpperCase()}.`;
  return cap(base);
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Global leaderboard by XP — weekly (sum of xp_events since Monday) or all-time
 * (profiles.xp_total). Runs with the server DB connection (bypasses RLS) so it
 * can rank every reader; only a masked display name + XP + streak is exposed.
 */
export async function getLeaderboard(
  user: CoreUser,
  scope: "week" | "all",
): Promise<LeaderboardResponse> {
  const streaks = await db
    .select({ userId: schema.streaks.userId, days: schema.streaks.currentDays })
    .from(schema.streaks);
  const streakBy = new Map(streaks.map((s) => [s.userId, s.days]));

  let ranked: { userId: string; name: string | null; avatar: string | null; xp: number }[];

  if (scope === "week") {
    const rows = await db
      .select({
        userId: schema.xpEvents.userId,
        xp: sql<number>`sum(${schema.xpEvents.delta})`.mapWith(Number),
      })
      .from(schema.xpEvents)
      .where(gte(schema.xpEvents.occurredAt, new Date(startOfWeekISO())))
      .groupBy(schema.xpEvents.userId)
      .orderBy(desc(sql`sum(${schema.xpEvents.delta})`))
      .limit(100);
    const ids = rows.map((r) => r.userId);
    const profs = ids.length
      ? await db
          .select({
            id: schema.profiles.id,
            name: schema.profiles.displayName,
            avatar: schema.profiles.avatar,
          })
          .from(schema.profiles)
          .where(inArray(schema.profiles.id, ids))
      : [];
    const by = new Map(profs.map((n) => [n.id, n]));
    ranked = rows.map((r) => ({
      userId: r.userId,
      name: by.get(r.userId)?.name ?? null,
      avatar: by.get(r.userId)?.avatar ?? null,
      xp: r.xp,
    }));
  } else {
    const rows = await db
      .select({
        userId: schema.profiles.id,
        name: schema.profiles.displayName,
        avatar: schema.profiles.avatar,
        xp: schema.profiles.xpTotal,
      })
      .from(schema.profiles)
      .orderBy(desc(schema.profiles.xpTotal))
      .limit(100);
    ranked = rows;
  }

  const rows: LeaderRow[] = ranked.map((r) => ({
    userId: r.userId,
    name: displayName(r.name),
    avatar: r.avatar,
    xp: r.xp ?? 0,
    streak: streakBy.get(r.userId) ?? 0,
    isYou: r.userId === user.id,
  }));

  const youIndex = rows.findIndex((r) => r.isYou);
  const you =
    youIndex >= 0
      ? { ...rows[youIndex], rank: youIndex + 1 }
      : await selfRow(user, scope, streakBy.get(user.id) ?? 0);

  return { scope, rows: rows.slice(0, 25), you };
}

/** The caller's own row + rank when they're outside the top 100. */
async function selfRow(
  user: CoreUser,
  scope: "week" | "all",
  streak: number,
): Promise<(LeaderRow & { rank: number }) | null> {
  const [prof] = await db
    .select({ name: schema.profiles.displayName, avatar: schema.profiles.avatar })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);

  if (scope === "all") {
    const [me] = await db
      .select({ xp: schema.profiles.xpTotal })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1);
    if (!me) return null;
    const [{ ahead }] = await db
      .select({ ahead: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.profiles)
      .where(sql`${schema.profiles.xpTotal} > ${me.xp}`);
    return {
      userId: user.id,
      name: displayName(prof?.name ?? null),
      avatar: prof?.avatar ?? null,
      xp: me.xp ?? 0,
      streak,
      isYou: true,
      rank: ahead + 1,
    };
  }
  const [me] = await db
    .select({ xp: sql<number>`coalesce(sum(${schema.xpEvents.delta}),0)`.mapWith(Number) })
    .from(schema.xpEvents)
    .where(
      and(
        eq(schema.xpEvents.userId, user.id),
        gte(schema.xpEvents.occurredAt, new Date(startOfWeekISO())),
      ),
    );
  return {
    userId: user.id,
    name: "You",
    avatar: prof?.avatar ?? null,
    xp: me?.xp ?? 0,
    streak,
    isYou: true,
    rank: 0,
  };
}
