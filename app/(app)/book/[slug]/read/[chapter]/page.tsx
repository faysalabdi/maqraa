import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { getBookBySlug } from "@/lib/db/queries/path";
import { getPlan, canReadTier } from "@/lib/entitlement";
import { lookupKey } from "@/lib/arabic";
import { ChapterReader } from "@/components/reader/ChapterReader";

export const dynamic = "force-dynamic";

export default async function ReadChapterPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = await params;
  const chapterNumber = Number(chapter);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) notFound();

  const book = await getBookBySlug(slug);
  if (!book || !book.hasFullText) notFound();

  const chapters = await db
    .select({
      id: schema.bookChapters.id,
      chapterNumber: schema.bookChapters.chapterNumber,
      titleAr: schema.bookChapters.titleAr,
      titleEn: schema.bookChapters.titleEn,
      contentAr: schema.bookChapters.contentAr,
    })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.bookId, book.id))
    .orderBy(asc(schema.bookChapters.chapterNumber));

  const current = chapters.find((c) => c.chapterNumber === chapterNumber);
  if (!current) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  // Private uploads are readable only by their owner.
  if (book.ownerId && book.ownerId !== user.id) notFound();
  // Curated books above the free tier require Pro. Own uploads are never gated.
  if (!book.ownerId) {
    const plan = await getPlan(user.id, user.email);
    if (!canReadTier(plan, book.level)) redirect("/upgrade");
  }

  const saved = await db
    .select({ lemmaAr: schema.vocabItems.lemmaAr })
    .from(schema.vocabItems)
    .where(eq(schema.vocabItems.userId, user.id));
  const savedKeys = saved.map((s) => lookupKey(s.lemmaAr));

  const progress = await db
    .select({
      chapterId: schema.userChapterProgress.chapterId,
      status: schema.userChapterProgress.status,
    })
    .from(schema.userChapterProgress)
    .where(and(eq(schema.userChapterProgress.userId, user.id)));
  const completedIds = new Set(
    progress.filter((p) => p.status === "completed").map((p) => p.chapterId),
  );

  return (
    <ChapterReader
      bookSlug={slug}
      bookTitleAr={book.titleAr}
      chapter={current}
      totalChapters={chapters.length}
      showBookTest={!book.ownerId}
      chapterList={chapters.map((c) => ({
        n: c.chapterNumber,
        titleAr: c.titleAr,
        titleEn: c.titleEn,
      }))}
      nextChapterNumber={
        chapters.find((c) => c.chapterNumber > chapterNumber)?.chapterNumber ?? null
      }
      initialSavedKeys={savedKeys}
      alreadyCompleted={completedIds.has(current.id)}
    />
  );
}
