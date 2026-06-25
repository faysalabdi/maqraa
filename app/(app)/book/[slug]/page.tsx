import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBookBySlug, getUserBook, type BookStatus } from "@/lib/db/queries/path";
import { db, schema } from "@/lib/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, BookOpen, Check, CircleDot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookCover, bandFor } from "@/components/book/BookCover";
import { BookStatusBanner } from "@/components/book/BookStatusBanner";
import { AttemptHistory, type AttemptRow } from "@/components/book/AttemptHistory";

export const dynamic = "force-dynamic";

const GENRE_LABEL: Record<string, string> = {
  islamic: "Islamic",
  arabic_literature: "Arabic Literature",
  translated: "Translated",
  graded_reader: "Graded Reader",
  classical: "Classical",
};

const GENRE_TINT: Record<string, string> = {
  islamic: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  arabic_literature: "bg-amber-50 text-amber-800 ring-amber-200",
  translated: "bg-sky-50 text-sky-800 ring-sky-200",
  graded_reader: "bg-violet-50 text-violet-800 ring-violet-200",
  classical: "bg-rose-50 text-rose-800 ring-rose-200",
};

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Private uploads are visible only to their owner.
  if (book.ownerId && book.ownerId !== user?.id) notFound();

  const userBook = user ? await getUserBook(user.id, book.id) : null;

  const chapters = book.hasFullText
    ? await db
        .select()
        .from(schema.bookChapters)
        .where(eq(schema.bookChapters.bookId, book.id))
        .orderBy(asc(schema.bookChapters.chapterNumber))
    : [];

  const progressMap = new Map<string, { status: string; quizScore: string | null }>();
  if (user && chapters.length > 0) {
    const rows = await db
      .select()
      .from(schema.userChapterProgress)
      .where(
        and(
          eq(schema.userChapterProgress.userId, user.id),
          inArray(
            schema.userChapterProgress.chapterId,
            chapters.map((c) => c.id),
          ),
        ),
      );
    for (const r of rows) progressMap.set(r.chapterId, r);
  }

  const completedChapters = chapters.filter(
    (c) => progressMap.get(c.id)?.status === "completed",
  ).length;
  const firstUnfinished =
    chapters.find((c) => progressMap.get(c.id)?.status !== "completed") ?? chapters[0];

  let attempts: AttemptRow[] = [];
  if (user) {
    const rows = await db
      .select({
        id: schema.comprehensionAttempts.id,
        score: schema.comprehensionAttempts.score,
        passed: schema.comprehensionAttempts.passed,
        submittedAt: schema.comprehensionAttempts.submittedAt,
      })
      .from(schema.comprehensionAttempts)
      .where(
        and(
          eq(schema.comprehensionAttempts.userId, user.id),
          eq(schema.comprehensionAttempts.bookId, book.id),
        ),
      )
      .orderBy(desc(schema.comprehensionAttempts.submittedAt))
      .limit(10);
    attempts = rows.map((r) => ({
      id: r.id,
      score: Number(r.score),
      passed: r.passed,
      submittedAt: r.submittedAt,
    }));
  }

  const status: BookStatus | null = userBook ? (userBook.status as BookStatus) : null;
  const bestScore = userBook?.bestScore ? Number(userBook.bestScore) : null;
  const attemptCount = userBook?.attempts ?? 0;

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-6">
      <Link
        href="/path"
        className="inline-flex items-center gap-1 text-sm font-medium text-fg-muted transition hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back to library
      </Link>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/10 via-surface to-surface p-6 shadow-card ring-1 ring-border sm:p-8">
        <span
          aria-hidden
          className="font-arabic pointer-events-none absolute -top-4 right-3 select-none text-7xl font-bold text-fg/[0.05] sm:text-8xl"
          dir="rtl"
        >
          {book.titleAr}
        </span>
        <div className="relative flex gap-5 sm:gap-7">
          <BookCover
            titleAr={book.titleAr}
            authorAr={book.authorAr}
            authorEn={book.authorEn}
            genre={book.genre}
            level={book.level}
            size="lg"
            className="w-28 sm:w-36"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent-fg">
                Band {bandFor(book.level)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${GENRE_TINT[book.genre] ?? "bg-zinc-100 text-zinc-800 ring-zinc-200"}`}
              >
                {GENRE_LABEL[book.genre] ?? book.genre}
              </span>
            </div>

            <h1 className="font-serif mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              {book.titleEn}
            </h1>
            <p className="font-arabic mt-1 text-xl text-fg-muted" dir="rtl">
              {book.titleAr}
            </p>
            <p className="mt-2 text-sm text-fg-muted">
              {[
                book.authorEn,
                `${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`,
                book.recommendedPages ? `~${book.recommendedPages.toLocaleString()} pages` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <p className="mt-6 text-base leading-relaxed text-fg-muted">{book.blurb}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          {chapters.length > 0 && firstUnfinished && (
            <Link
              href={`/book/${slug}/read/${firstUnfinished.chapterNumber}`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
            >
              <BookOpen className="h-4 w-4" />
              {completedChapters === 0
                ? "Start reading"
                : completedChapters === chapters.length
                  ? "Read again"
                  : `Continue — chapter ${firstUnfinished.chapterNumber}`}
            </Link>
          )}

          {chapters.length > 0 && !book.ownerId && (
            <Link
              href={`/book/${book.slug}/test`}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold transition hover:bg-bg-muted"
            >
              <Sparkles className="h-4 w-4" />
              {status === "completed" ? "Retake comprehension test" : "Test your comprehension (optional)"}
            </Link>
          )}
        </div>
      </div>

      {chapters.length > 0 && (
        <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Chapters</h2>
            <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-fg-muted">
              {completedChapters} / {chapters.length} complete
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(completedChapters / chapters.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {chapters.map((c) => {
              const p = progressMap.get(c.id);
              const isCompleted = p?.status === "completed";
              const isReading = p?.status === "reading";

              return (
                <li key={c.id}>
                  <Link
                    href={`/book/${slug}/read/${c.chapterNumber}`}
                    className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 transition hover:border-brand hover:bg-brand/5"
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                        isCompleted
                          ? "bg-brand text-brand-fg"
                          : isReading
                            ? "bg-accent/30 text-accent-fg"
                            : "bg-bg-muted text-fg-muted",
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : isReading ? (
                        <CircleDot className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-bold">{c.chapterNumber}</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-arabic truncate text-lg font-semibold" dir="rtl">
                        {c.titleAr}
                      </p>
                      <p className="truncate text-xs text-fg-muted">{c.titleEn}</p>
                    </div>
                    {p?.quizScore && (
                      <span className="text-xs font-bold text-fg-muted">
                        {Math.round(Number(p.quizScore))}%
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <BookStatusBanner status={status} bestScore={bestScore} attempts={attemptCount} />

      <AttemptHistory attempts={attempts} />
    </main>
  );
}
