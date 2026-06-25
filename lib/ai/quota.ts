import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Per-user daily ceilings on Claude-backed actions. Generous for real use,
// hard stops for abuse / runaway cost.
const LIMITS: Record<string, number> = {
  lookup: 500, // distinct word lookups that miss the global cache
  quiz: 100, // chapter quiz opens
  test: 40, // whole-book test generations
  analyze: 25, // EPUB upload analyses
};

/**
 * Increment today's counter for (user, kind) and throw once it exceeds the
 * limit. Atomic upsert so concurrent calls can't race past the cap.
 */
export async function consumeAiQuota(userId: string, kind: keyof typeof LIMITS): Promise<void> {
  const max = LIMITS[kind] ?? 100;
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
    throw new Error("You've reached today's limit for this — it resets tomorrow.");
  }
}
