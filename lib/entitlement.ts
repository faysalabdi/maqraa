import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { tierFor, type Tier } from "@/components/book/BookCover";

export type Plan = "free" | "pro";

// What the free tier gets. Everything else is Pro. Kept in one place so the
// paywall copy and the server gates can't drift apart.
export const FREE = {
  /** Curated difficulty tiers a free reader can open. */
  tiers: ["Beginner"] as Tier[],
  /** Max saved vocab words on free before the SRS deck is capped. */
  maxSavedWords: 50,
  /** Uploading your own books is Pro-only. */
  uploads: false,
} as const;

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** The user's plan. Admins are always Pro. Absent/expired subscription = free. */
export async function getPlan(userId: string, email?: string | null): Promise<Plan> {
  if (isAdmin(email)) return "pro";
  const [sub] = await db
    .select({ status: schema.subscriptions.status, end: schema.subscriptions.currentPeriodEnd })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);
  if (!sub || !sub.status || !ACTIVE_STATUSES.has(sub.status)) return "free";
  // A canceled-but-paid subscription stays active until the period actually ends.
  if (sub.end && sub.end.getTime() < Date.now()) return "free";
  return "pro";
}

export async function isPro(userId: string, email?: string | null): Promise<boolean> {
  return (await getPlan(userId, email)) === "pro";
}

/** Whether a plan may open a curated book of the given difficulty level. */
export function canReadTier(plan: Plan, level: number): boolean {
  return plan === "pro" || FREE.tiers.includes(tierFor(level));
}
