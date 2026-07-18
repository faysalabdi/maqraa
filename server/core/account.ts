import { eq, inArray } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { db, schema } from "@/lib/db";
import { billingEnabled, getStripe } from "@/lib/stripe/server";
import type { CoreUser } from "./user";

/**
 * Permanently delete a user: cancel any live subscription, remove all of their
 * data (including books they uploaded), then delete the auth user. Irreversible.
 * Callers handle their own session teardown (web signs out the cookie session;
 * mobile clears its stored session).
 */
export async function deleteAccountCore(user: CoreUser): Promise<void> {
  const uid = user.id;

  // 1. Stop billing — cancel any live subscription so they aren't charged again.
  if (billingEnabled()) {
    try {
      const [sub] = await db
        .select({ subId: schema.subscriptions.stripeSubscriptionId, status: schema.subscriptions.status })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, uid))
        .limit(1);
      if (sub?.subId && (sub.status === "active" || sub.status === "trialing")) {
        await getStripe().subscriptions.cancel(sub.subId);
      }
    } catch (e) {
      console.error("[deleteAccount] stripe cancel failed:", e);
    }
  }

  // 2. Delete books this user uploaded, cascading dependents (mirrors deleteBook).
  const ownBooks = await db
    .select({ id: schema.books.id })
    .from(schema.books)
    .where(eq(schema.books.ownerId, uid));
  for (const b of ownBooks) {
    const chaps = await db
      .select({ id: schema.bookChapters.id })
      .from(schema.bookChapters)
      .where(eq(schema.bookChapters.bookId, b.id));
    const cids = chaps.map((c) => c.id);
    await db.delete(schema.comprehensionAttempts).where(eq(schema.comprehensionAttempts.bookId, b.id));
    await db.delete(schema.comprehensionTests).where(eq(schema.comprehensionTests.bookId, b.id));
    await db.delete(schema.readingSessions).where(eq(schema.readingSessions.bookId, b.id));
    await db.delete(schema.userBooks).where(eq(schema.userBooks.bookId, b.id));
    if (cids.length) {
      await db.delete(schema.userChapterProgress).where(inArray(schema.userChapterProgress.chapterId, cids));
      await db.delete(schema.chapterQuizzes).where(inArray(schema.chapterQuizzes.chapterId, cids));
    }
    await db.delete(schema.bookChapters).where(eq(schema.bookChapters.bookId, b.id));
    await db.delete(schema.books).where(eq(schema.books.id, b.id));
  }

  // 3. Delete this user's own rows across every per-user table.
  await db.delete(schema.comprehensionAttempts).where(eq(schema.comprehensionAttempts.userId, uid));
  await db.delete(schema.comprehensionTests).where(eq(schema.comprehensionTests.userId, uid));
  await db.delete(schema.readingSessions).where(eq(schema.readingSessions.userId, uid));
  await db.delete(schema.userChapterProgress).where(eq(schema.userChapterProgress.userId, uid));
  await db.delete(schema.userBooks).where(eq(schema.userBooks.userId, uid));
  await db.delete(schema.vocabItems).where(eq(schema.vocabItems.userId, uid));
  await db.delete(schema.xpEvents).where(eq(schema.xpEvents.userId, uid));
  await db.delete(schema.userAchievements).where(eq(schema.userAchievements.userId, uid));
  await db.delete(schema.streaks).where(eq(schema.streaks.userId, uid));
  await db.delete(schema.usageEvents).where(eq(schema.usageEvents.userId, uid));
  await db.delete(schema.conversationSessions).where(eq(schema.conversationSessions.userId, uid));
  await db.delete(schema.aiUsage).where(eq(schema.aiUsage.userId, uid));
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.userId, uid));
  await db.delete(schema.profiles).where(eq(schema.profiles.id, uid));

  // 4. Delete the auth user (service role).
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) throw new Error(error.message);
}
