import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { ArrowRight, BookOpen, Check, Flame } from "lucide-react";
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
  mine: boolean;
};

export default async function ReadPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    allBooks,
  ] = await Promise.all([
    supabase.auth.getUser(),
    db
      .select()
      .from(schema.books)
      .where(eq(schema.books.hasFullText, true))
      .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel)),
  ]);

  let streakDays = 0;
  let displayName: string | null = null;
  const userBookMap = new Map<string, string>();

  if (user) {
    const [profileRows, userBookRows, streakRows] = await Promise.all([
      db
        .select({ displayName: schema.profiles.displayName })
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
    displayName = profileRows[0]?.displayName ?? user.email ?? null;
    streakDays = streakRows[0]?.currentDays ?? 0;
    for (const r of userBookRows) userBookMap.set(r.bookId, r.status);
  }

  // No locks. Curated books (no owner) are public; private uploads only show to
  // their owner. Progress is by finishing books, not by clearing stages.
  const cards = allBooks
    .filter((b) => !b.ownerId || b.ownerId === user?.id)
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
      mine: !!b.ownerId,
      status: (userBookMap.get(b.id) as BookStatus) ?? "unlocked",
    }));

  if (cards.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-16 text-center">
        <div className="rounded-3xl bg-surface p-10 shadow-card ring-1 ring-border">
          <p className="font-arabic text-4xl text-brand" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-3 text-2xl font-extrabold">No books yet</h1>
          <p className="mt-2 text-sm text-fg-muted">The starter shelf is being set up — check back soon.</p>
        </div>
      </main>
    );
  }

  const curated = cards.filter((c) => !c.mine);
  const mine = cards.filter((c) => c.mine);

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
        <div className="mt-8">
          <Section title="Start here" subtitle="A short graded on-ramp" cards={curated} />
        </div>
      </main>
    );
  }

  const current = cards
    .filter((b) => b.status !== "completed")
    .sort(
      (a, b) =>
        RESUME_PRIORITY[a.status] - RESUME_PRIORITY[b.status] ||
        a.level - b.level ||
        a.orderInLevel - b.orderInLevel,
    )[0];
  const finishedCount = cards.filter((b) => b.status === "completed").length;
  const curatedFinished = curated.filter((b) => b.status === "completed").length;
  const name = displayName?.split("@")[0] ?? null;
  const firstTime = userBookMap.size === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
      {/* Continue / welcome / all-done hero */}
      {current ? (
        <section className="animate-rise overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-border">
          <div className="flex items-stretch gap-5 p-5 sm:p-6">
            <Link href={`/book/${current.slug}`} className="group shrink-0">
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
                {firstTime ? (name ? `Welcome, ${name}` : "Welcome") : "Continue reading"}
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
                  {firstTime ? "Start reading" : statusVerb(current.status)}
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
          <p className="text-lg font-bold">You&apos;ve finished every book here 🎉</p>
          <p className="mt-1 text-sm text-fg-muted">Bring your own next — upload an EPUB to keep going.</p>
          <Link
            href="/upload"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
          >
            Add a book <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      <div className="mt-3 text-right text-sm text-fg-muted">{finishedCount} books finished</div>

      <div className="mt-6 space-y-10">
        <Section
          title="Start here"
          subtitle={`${curatedFinished} of ${curated.length} finished`}
          cards={curated}
        />
        {mine.length > 0 && <Section title="Your library" subtitle="Books you added" cards={mine} />}
      </div>

      <p className="mt-12 text-center text-xs text-fg-muted">
        Finished the starter shelf? Bring your own books from Upload.
      </p>
    </main>
  );
}

function statusVerb(status: BookStatus): string {
  switch (status) {
    case "failed_retry":
      return "Keep reading";
    case "in_progress":
      return "Continue";
    default:
      return "Start reading";
  }
}

function Section({ title, subtitle, cards }: { title: string; subtitle?: string; cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        {subtitle && (
          <span className="ml-auto text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            {subtitle}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
        {cards.map((b) => (
          <BookTile key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}

function BookTile({ book }: { book: Card }) {
  const completed = book.status === "completed";
  const inProgress = ["in_progress", "reading_done", "testing", "failed_retry"].includes(book.status);

  return (
    <Link href={`/book/${book.slug}`} className="group">
      <div className="relative">
        <BookCover
          titleAr={book.titleAr}
          authorAr={book.authorAr}
          authorEn={book.authorEn}
          genre={book.genre}
          size="md"
          className="w-full transition group-hover:-translate-y-1 group-hover:shadow-lift"
        />
        {completed && (
          <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-brand text-brand-fg shadow-soft ring-2 ring-surface">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
        {inProgress && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg shadow-soft">
            Reading
          </span>
        )}
        {book.mine && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-iris px-2 py-0.5 text-[10px] font-bold text-iris-fg shadow-soft">
            Yours
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-center text-xs font-semibold text-fg">{book.titleEn}</p>
    </Link>
  );
}
