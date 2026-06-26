import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getPlan } from "@/lib/entitlement";

// Per-user daily ceilings on Claude-backed actions, by plan. Free is generous
// enough to try the product; Pro is generous enough for real daily use. Both are
// hard stops against runaway cost / abuse.
const PRO_LIMITS: Record<string, number> = {
  lookup: 1000, // distinct word lookups that miss the global cache
  prewarm: 600, // background chapter pre-warming (also globally cached)
  quiz: 200, // chapter quiz opens
  test: 80, // whole-book test generations
  grade: 120, // open-ended test submissions graded by AI
  analyze: 50, // EPUB upload analyses
};

const FREE_LIMITS: Record<string, number> = {
  lookup: 30,
  prewarm: 60,
  quiz: 8,
  test: 5,
  grade: 8,
  analyze: 0, // uploads are Pro-only; free never analyses
};

export type QuotaKind = keyof typeof PRO_LIMITS;

/**
 * Increment today's counter for (user, kind) and throw once it exceeds the
 * user's plan limit. Atomic upsert so concurrent calls can't race past the cap.
 */
export async function consumeAiQuota(userId: string, kind: QuotaKind): Promise<void> {
  const plan = await getPlan(userId);
  const limits = plan === "pro" ? PRO_LIMITS : FREE_LIMITS;
  const max = limits[kind] ?? 0;
  if (max <= 0) {
    throw new Error("This is a Pro feature — upgrade to use it.");
  }

  const day = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .insert(schema.aiUsage)
    .values({ userId, day, kind, count: 1 })
    .onConflictDoUpdate({
      target: [schema.aiUsage.userId, schema.aiUsage.day, schema.aiUsage.kind],
      set: { count: sql`${schema.aiUsage.count} + 1` },
    })
    .returning({ count: schema.aiUsage.count });
  if ((row?.count ?? 0) > max) {
    const suffix =
      plan === "free" ? " Upgrade to Pro for much higher limits." : " It resets tomorrow.";
    throw new Error(`You've reached today's limit for this.${suffix}`);
  }
}
