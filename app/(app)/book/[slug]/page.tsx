import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBookBySlug, getUserBook } from "@/lib/db/queries/path";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { ArrowLeft, Sparkles } from "lucide-react";
import LogSessionDialog from "@/components/book/LogSessionDialog";

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

        {book.recommendedPages && (
          <p className="mt-4 text-sm text-fg-muted">
            Recommended pages: ~{book.recommendedPages.toLocaleString()}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <LogSessionDialog
              bookId={book.id}
              bookSlug={book.slug}
              canMarkDone={
                !userBook ||
                (userBook.status !== "reading_done" &&
                  userBook.status !== "testing" &&
                  userBook.status !== "completed")
              }
            />
          ) : null}

          {userBook?.status === "reading_done" ||
          userBook?.status === "testing" ||
          userBook?.status === "failed_retry" ? (
            <a
              href={`/book/${book.slug}/test`}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold transition hover:bg-bg-muted"
            >
              <Sparkles className="h-4 w-4" /> Take comprehension test
            </a>
          ) : (
            <button
              disabled
              title="Mark the book finished first"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold opacity-40"
            >
              <Sparkles className="h-4 w-4" /> Take comprehension test
            </button>
          )}
        </div>

        {userBook && (
          <p className="mt-4 text-sm text-fg-muted">
            Status: <span className="font-semibold text-fg">{userBook.status}</span> ·{" "}
            {userBook.pagesRead} pages logged · {userBook.minutesRead} minutes
          </p>
        )}
      </div>

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
