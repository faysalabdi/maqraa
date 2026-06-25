import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { ArrowRight, BookOpen, Check, Flame, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book/BookCover";
import type { BookStatus } from "@/lib/db/queries/path";

export const dynamic = "force-dynamic";

const RESUME_PRIORITY: Record<BookStatus, number> = {
  failed_retry: 0,
  testing: 1,
  reading_done: 2,
  in_progress: 3,
  unlocked: 4,
  locked: 99,
  completed: 99,
};

type Card = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  authorAr: string | null;
  authorEn: string | null;
  genre: string;
  level: number;
  orderInLevel: number;
  status: BookStatus;
};

export default async function ReadPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    levels,
    allBooks,
  ] = await Promise.all([
    supabase.auth.getUser(),
    db.select().from(schema.levels).orderBy(asc(schema.levels.level)),
    db
      .select()
      .from(schema.books)
      .where(eq(schema.books.hasFullText, true))
      .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel)),
  ]);

  let userLevel = 1;
  let streakDays = 0;
  let displayName: string | null = null;
  const userBookMap = new Map<string, string>();

  if (user) {
    const [profileRows, userBookRows, streakRows] = await Promise.all([
      db
        .select({ currentLevel: schema.profiles.currentLevel, displayName: schema.profiles.displayName })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, user.id))
        .limit(1),
      db.select().from(schema.userBooks).where(eq(schema.userBooks.userId, user.id)),
      db
        .select({ currentDays: schema.streaks.currentDays })
        .from(schema.streaks)
        .where(eq(schema.streaks.userId, user.id))
        .limit(1),
    ]);
    userLevel = profileRows[0]?.currentLevel ?? 1;
    displayName = profileRows[0]?.displayName ?? user.email ?? null;
    streakDays = streakRows[0]?.currentDays ?? 0;
    for (const r of userBookRows) userBookMap.set(r.bookId, r.status);
  }

  const shelves = levels
    .map((lv) => ({
      level: lv.level,
      nameEn: lv.nameEn,
      nameAr: lv.nameAr,
      locked: lv.level > userLevel,
      books: allBooks
        .filter((b) => b.level === lv.level)
        .map<Card>((b) => ({
          id: b.id,
          slug: b.slug,
          titleAr: b.titleAr,
          titleEn: b.titleEn,
          authorAr: b.authorAr,
          authorEn: b.authorEn,
          genre: b.genre,
          level: b.level,
          orderInLevel: b.orderInLevel,
          status: userBookMap.has(b.id)
            ? (userBookMap.get(b.id) as BookStatus)
            : b.level <= userLevel
              ? "unlocked"
              : "locked",
        })),
    }))
    .filter((s) => s.books.length > 0);

  if (shelves.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-16 text-center">
        <div className="rounded-3xl bg-surface p-10 shadow-card ring-1 ring-border">
          <p className="font-arabic text-4xl text-brand" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-3 text-2xl font-extrabold">No books yet</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Add your first book from the Upload screen — drop an EPUB and it appears here.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-dark to-brand p-10 text-center text-brand-fg shadow-lift">
          <p className="font-arabic text-5xl" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-3 text-3xl font-extrabold">Read real Arabic, beautifully</h1>
          <p className="mx-auto mt-2 max-w-md text-brand-fg/85">
            Tap any word to translate and save it. Finish books, build a streak, grow a vocabulary.
          </p>
          <Link
            href="/sign-in?redirect=/path"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-surface px-6 py-3 text-base font-extrabold text-brand transition hover:shadow-lift"
          >
            Start reading <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
        <div className="mt-8 space-y-8">
          {shelves.map((s) => (
            <Shelf key={s.level} shelf={s} />
          ))}
        </div>
      </main>
    );
  }

  const all = shelves.flatMap((s) => s.books);
  const current = all
    .filter((b) => b.status !== "locked" && b.status !== "completed")
    .sort(
      (a, b) =>
        RESUME_PRIORITY[a.status] - RESUME_PRIORITY[b.status] ||
        a.level - b.level ||
        a.orderInLevel - b.orderInLevel,
    )[0];
  const completed = all.filter((b) => b.status === "completed").length;
  const name = displayName?.split("@")[0] ?? null;
  const firstName = !userBookMap.size;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
      {/* Continue / welcome hero */}
      {current ? (
        <section className="animate-rise overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-border">
          <div className="flex items-stretch gap-5 p-5 sm:p-6">
            <Link href={`/book/${current.slug}`} className="shrink-0">
              <BookCover
                titleAr={current.titleAr}
                authorAr={current.authorAr}
                authorEn={current.authorEn}
                genre={current.genre}
                size="md"
                className="w-24 transition group-hover:scale-105 sm:w-28"
              />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="text-sm font-semibold text-fg-muted">
                {firstName ? (name ? `Welcome, ${name}` : "Welcome") : "Continue reading"}
              </p>
              <h1 className="font-arabic mt-0.5 truncate text-2xl font-bold" dir="rtl">
                {current.titleAr}
              </h1>
              <p className="truncate text-sm text-fg-muted">{current.titleEn}</p>
              <div className="mt-3 flex items-center gap-3">
                <Link
                  href={`/book/${current.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                >
                  <BookOpen className="h-4 w-4" />
                  {firstName ? "Start reading" : statusVerb(current.status)}
                </Link>
                {streakDays > 0 && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-flame">
                    <Flame className="h-4 w-4" /> {streakDays}d
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="animate-rise rounded-3xl bg-surface p-6 text-center shadow-card ring-1 ring-border">
          <p className="text-lg font-bold">You&apos;ve finished every book available 🎉</p>
          <p className="mt-1 text-sm text-fg-muted">
            More titles arrive over time. Keep your streak with a quick review.
          </p>
          <Link
            href="/review"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
          >
            Review words <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      <div className="mt-3 text-right text-sm text-fg-muted">
        {completed} of {all.length} books finished
      </div>

      <div className="mt-6 space-y-9">
        {shelves.map((s) => (
          <Shelf key={s.level} shelf={s} />
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-fg-muted">
        More books are added over time. Want a specific title? Let us know.
      </p>
    </main>
  );
}

function statusVerb(status: BookStatus): string {
  switch (status) {
    case "reading_done":
      return "Take the test";
    case "testing":
      return "Finish the test";
    case "failed_retry":
      return "Retry the test";
    case "in_progress":
      return "Continue";
    default:
      return "Start reading";
  }
}

function Shelf({
  shelf,
}: {
  shelf: { level: number; nameEn: string; nameAr: string; locked: boolean; books: Card[] };
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">{shelf.nameEn}</h2>
        <span className="font-arabic text-sm text-fg-muted" dir="rtl">
          {shelf.nameAr}
        </span>
        <span className="ml-auto text-[11px] font-bold uppercase tracking-wider text-fg-muted">
          Stage {shelf.level}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
        {shelf.books.map((b) => (
          <BookTile key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}

function BookTile({ book }: { book: Card }) {
  const locked = book.status === "locked";
  const completed = book.status === "completed";
  const inProgress = ["in_progress", "reading_done", "testing", "failed_retry"].includes(book.status);

  const inner = (
    <>
      <div className="relative">
        <BookCover
          titleAr={book.titleAr}
          authorAr={book.authorAr}
          authorEn={book.authorEn}
          genre={book.genre}
          size="md"
          className={cn("w-full transition", locked ? "opacity-45 saturate-50" : "group-hover:-translate-y-1 group-hover:shadow-lift")}
        />
        {completed && (
          <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-brand text-brand-fg shadow-soft ring-2 ring-surface">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
        {locked && (
          <span className="absolute inset-0 grid place-items-center">
            <Lock className="h-5 w-5 text-white/80" />
          </span>
        )}
        {inProgress && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg shadow-soft">
            Reading
          </span>
        )}
      </div>
      <p className={cn("mt-2 line-clamp-2 text-center text-xs font-semibold", locked ? "text-fg-muted" : "text-fg")}>
        {book.titleEn}
      </p>
    </>
  );

  if (locked) return <div className="group">{inner}</div>;
  return (
    <Link href={`/book/${book.slug}`} className="group">
      {inner}
    </Link>
  );
}
