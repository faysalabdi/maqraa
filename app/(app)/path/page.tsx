import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { PathSection } from "@/components/path/PathSection";

export const dynamic = "force-dynamic";

export default async function PathPage() {
  const supabase = await createClient();

  // Fetch auth + catalogue in parallel
  const [{ data: { user } }, levels, books] = await Promise.all([
    supabase.auth.getUser(),
    db.select().from(schema.levels).orderBy(asc(schema.levels.level)),
    db.select().from(schema.books).orderBy(asc(schema.books.level), asc(schema.books.orderInLevel)),
  ]);

  // Fetch profile + user_books in parallel (both need userId)
  let userLevel = 1;
  const userBookMap = new Map<string, string>();

  if (user) {
    const [profileRows, userBookRows] = await Promise.all([
      db.select({ currentLevel: schema.profiles.currentLevel })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, user.id))
        .limit(1),
      db.select().from(schema.userBooks).where(eq(schema.userBooks.userId, user.id)),
    ]);
    userLevel = profileRows[0]?.currentLevel ?? 1;
    for (const r of userBookRows) userBookMap.set(r.bookId, r.status);
  }

  const path = levels.map((lv) => ({
    level: lv.level,
    slug: lv.slug,
    nameEn: lv.nameEn,
    nameAr: lv.nameAr,
    description: lv.description,
    booksRequiredToClear: lv.booksRequiredToClear,
    books: books
      .filter((b) => b.level === lv.level)
      .map((b) => {
        const stored = userBookMap.get(b.id);
        const status = stored
          ? (stored as "locked" | "unlocked" | "in_progress" | "reading_done" | "testing" | "completed")
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
          status,
        };
      }),
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <div className="mb-4 text-center">
        <p className="font-arabic text-3xl text-brand" dir="rtl">
          اِقْرَأْ
        </p>
        <h1 className="mt-1 text-3xl font-extrabold">Your reading path</h1>
        <p className="mt-1 text-fg-muted">
          From children&apos;s stories to Ibn al-Qayyim. Pick a book and start.
        </p>
      </div>

      <div className="space-y-4">
        {path.map((level) => (
          <PathSection
            key={level.level}
            level={level}
            isLocked={level.level > userLevel}
          />
        ))}
      </div>
    </main>
  );
}
