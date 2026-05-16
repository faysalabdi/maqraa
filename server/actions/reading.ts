"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { grantXp, todayXp, recordActivity } from "@/lib/xp/grant";
import { XP_REWARDS, DAILY_CAPS } from "@/lib/xp/rewards";
import { checkAndGrantAchievements } from "@/lib/achievements/check";

export type LogSessionInput = {
  bookId: string;
  bookSlug: string;
  pages: number;
  minutes: number;
  note?: string;
};

export async function logSession(input: LogSessionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { bookId, bookSlug, pages, minutes, note } = input;

  // Insert reading session
  await db.insert(schema.readingSessions).values({
    userId: user.id,
    bookId,
    pages,
    minutes,
    note: note || null,
  });

  // Upsert user_books — create row if missing, bump counters, transition to in_progress
  const existing = await db
    .select()
    .from(schema.userBooks)
    .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.userBooks).values({
      userId: user.id,
      bookId,
      status: "in_progress",
      pagesRead: pages,
      minutesRead: minutes,
      startedAt: new Date(),
    });
  } else {
    const current = existing[0];
    const nextStatus =
      current.status === "unlocked" || current.status === "locked"
        ? "in_progress"
        : current.status;
    await db
      .update(schema.userBooks)
      .set({
        pagesRead: current.pagesRead + pages,
        minutesRead: current.minutesRead + minutes,
        status: nextStatus,
        startedAt: current.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)));
  }

  // XP for pages (capped at DAILY_CAPS.pageLogged per day)
  if (pages > 0) {
    const todayPages = await todayXp(user.id, "page_logged");
    const pageXpAvailable = Math.max(0, DAILY_CAPS.pageLogged - todayPages);
    const pageXp = Math.min(pages * XP_REWARDS.pageLogged, pageXpAvailable);
    if (pageXp > 0) {
      await grantXp({ userId: user.id, delta: pageXp, reason: "page_logged" });
    }
  }

  // XP for minutes (capped at DAILY_CAPS.minuteLogged per day)
  if (minutes > 0) {
    const todayMins = await todayXp(user.id, "minute_logged");
    const minXpAvailable = Math.max(0, DAILY_CAPS.minuteLogged - todayMins);
    const minXp = Math.min(minutes * XP_REWARDS.minuteLogged, minXpAvailable);
    if (minXp > 0) {
      await grantXp({ userId: user.id, delta: minXp, reason: "minute_logged" });
    }
  }

  await recordActivity(user.id);
  await checkAndGrantAchievements(user.id);

  revalidatePath(`/book/${bookSlug}`);
  revalidatePath("/path");
  return { ok: true };
}

export async function markReadingDone(bookId: string, bookSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const existing = await db
    .select()
    .from(schema.userBooks)
    .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)))
    .limit(1);

  if (existing.length === 0) {
    // Create the row as reading_done (edge case: mark done without logging a session)
    await db.insert(schema.userBooks).values({
      userId: user.id,
      bookId,
      status: "reading_done",
      startedAt: new Date(),
    });
  } else {
    const current = existing[0];
    // Only advance if not already completed
    if (current.status === "completed") {
      revalidatePath(`/book/${bookSlug}`);
      return { ok: true };
    }
    await db
      .update(schema.userBooks)
      .set({ status: "reading_done", updatedAt: new Date() })
      .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)));
  }

  revalidatePath(`/book/${bookSlug}`);
  revalidatePath("/path");
  return { ok: true };
}
