import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBookBySlug, getUserBook } from "@/lib/db/queries/path";
import { db, schema } from "@/lib/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { ArrowLeft, BookOpen, Check, CircleDot, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const completedCount = chapters.filter(
    (c) => progressMap.get(c.id)?.status === "completed",
  ).length;
  const firstUnfinished =
    chapters.find((c) => progressMap.get(c.id)?.status !== "completed") ?? chapters[0];

  const sessions = user
    ? await db
        .select()
        .from(schema.readingSessions)
        .where(
          and(
            eq(schema.readingSessions.userId, user.id),
            eq(schema.readingSessions.bookId, book.id),
          ),
        )
        .orderBy(desc(schema.readingSessions.readAt))
        .limit(5)
    : [];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link
        href="/path"
        className="mb-6 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back to path
      </Link>

      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-border">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
          Level {book.level} · {labelForGenre(book.genre)}
          {book.hasFullText && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-emerald-800">
              Readable in app
            </span>
          )}
        </p>
        <h1 className="font-arabic mt-3 text-4xl font-bold leading-tight" dir="rtl">
          {book.titleAr}
        </h1>
        <p className="mt-1 text-lg text-fg-muted">{book.titleEn}</p>
        {(book.authorEn || book.authorAr) && (
          <p className="mt-2 text-sm text-fg-muted">
            {book.authorEn}
            {book.authorAr && (
              <>
                {" "}
                · <span className="font-arabic">{book.authorAr}</span>
              </>
            )}
          </p>
        )}

        <p className="mt-6 text-base leading-relaxed">{book.blurb}</p>

        {book.hasFullText && chapters.length > 0 && firstUnfinished && (
          <Link
            href={`/book/${slug}/read/${firstUnfinished.chapterNumber}`}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-4 text-lg font-bold text-brand-fg shadow-lg shadow-emerald-200 transition hover:scale-105 hover:bg-brand-dark"
          >
            <BookOpen className="h-5 w-5" />
            {completedCount === 0
              ? "Start reading"
              : completedCount === chapters.length
                ? "Read again"
                : `Continue — chapter ${firstUnfinished.chapterNumber}`}
          </Link>
        )}

        {!book.hasFullText && (
          <div className="mt-8 rounded-2xl bg-bg-muted p-4 text-sm text-fg-muted">
            Read this one offline or in your own copy, then come back to log sessions and take
            the whole-book comprehension test. (In-app reading is available for public-domain
            and original books.)
          </div>
        )}

        {userBook && (
          <p className="mt-4 text-sm text-fg-muted">
            Status: <span className="font-semibold text-fg">{userBook.status}</span>
          </p>
        )}
      </div>

      {chapters.length > 0 && (
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Chapters</h2>
            <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-fg-muted">
              {completedCount} / {chapters.length} complete
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(completedCount / chapters.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {chapters.map((c, idx) => {
              const p = progressMap.get(c.id);
              const isCompleted = p?.status === "completed";
              const isReading = p?.status === "reading";
              const prevDone =
                idx === 0 ||
                progressMap.get(chapters[idx - 1].id)?.status === "completed";
              const isLocked = !isCompleted && !isReading && !prevDone;

              return (
                <li key={c.id}>
                  <Link
                    href={isLocked ? "#" : `/book/${slug}/read/${c.chapterNumber}`}
                    aria-disabled={isLocked}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 transition",
                      isLocked
                        ? "cursor-not-allowed border-border bg-bg-muted text-fg-muted"
                        : "border-border hover:border-brand hover:bg-emerald-50",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                        isCompleted
                          ? "bg-brand text-brand-fg"
                          : isReading
                            ? "bg-amber-100 text-amber-700"
                            : isLocked
                              ? "bg-zinc-200 text-zinc-400"
                              : "bg-bg-muted text-fg-muted",
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : isLocked ? (
                        <Lock className="h-4 w-4" />
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

      {sessions.length > 0 && (
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
          <h2 className="text-lg font-bold">Recent sessions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex justify-between text-fg-muted">
                <span>{new Date(s.readAt).toLocaleString()}</span>
                <span>
                  {s.pages}pp · {s.minutes}min
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!book.hasFullText && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold transition disabled:opacity-60"
            title="Coming soon"
          >
            <Sparkles className="h-4 w-4" /> Whole-book comprehension test (soon)
          </button>
        </div>
      )}
    </main>
  );
}

function labelForGenre(g: string) {
  switch (g) {
    case "islamic":
      return "Islamic";
    case "arabic_literature":
      return "Arabic Literature";
    case "translated":
      return "Translated";
    case "graded_reader":
      return "Graded Reader";
    case "classical":
      return "Classical";
    default:
      return g;
  }
}
