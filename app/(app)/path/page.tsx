import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, asc, and, count, inArray } from "drizzle-orm";
import { ArrowRight, BookCheck, Check, Flame, Brain, Play, Library } from "lucide-react";
import { BookCover, tierFor, TIERS } from "@/components/book/BookCover";
import { StatPill } from "@/components/chrome/StatPill";
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
  let wordsSaved = 0;
  let displayName: string | null = null;
  const userBookMap = new Map<string, string>();

  if (user) {
    const [profileRows, userBookRows, streakRows, wordRows] = await Promise.all([
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
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(eq(schema.vocabItems.userId, user.id)),
    ]);
    displayName = profileRows[0]?.displayName ?? user.email ?? null;
    streakDays = streakRows[0]?.currentDays ?? 0;
    wordsSaved = Number(wordRows[0]?.c ?? 0);
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
          <CuratedShelf cards={curated} />
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
  const name = displayName?.split("@")[0] ?? null;
  const firstTime = userBookMap.size === 0;

  // Continue-reading progress for the current book.
  let cont: { pct: number; chapterNum: number; total: number; chapterTitleAr: string } | null = null;
  if (current) {
    const chs = await db
      .select({
        id: schema.bookChapters.id,
        chapterNumber: schema.bookChapters.chapterNumber,
        titleAr: schema.bookChapters.titleAr,
      })
      .from(schema.bookChapters)
      .where(eq(schema.bookChapters.bookId, current.id))
      .orderBy(asc(schema.bookChapters.chapterNumber));
    if (chs.length) {
      const prog = user
        ? await db
            .select({ chapterId: schema.userChapterProgress.chapterId, status: schema.userChapterProgress.status })
            .from(schema.userChapterProgress)
            .where(
              and(
                eq(schema.userChapterProgress.userId, user.id),
                inArray(schema.userChapterProgress.chapterId, chs.map((c) => c.id)),
              ),
            )
        : [];
      const done = new Set(prog.filter((p) => p.status === "completed").map((p) => p.chapterId));
      const completed = chs.filter((c) => done.has(c.id)).length;
      const next = chs.find((c) => !done.has(c.id)) ?? chs[0];
      cont = {
        pct: Math.round((completed / chs.length) * 100),
        chapterNum: next.chapterNumber,
        total: chs.length,
        chapterTitleAr: next.titleAr,
      };
    }
  }
  const readHref = current ? `/book/${current.slug}${cont ? `/read/${cont.chapterNum}` : ""}` : "#";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pt-8">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-fg-muted">
            {firstTime ? "Welcome" : "Welcome back"}
            {name ? `, ${name}` : ""}
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Read</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatPill icon={<Flame className="h-3.5 w-3.5" />} tone={streakDays > 0 ? "flame" : "neutral"}>
            {streakDays}
          </StatPill>
          <StatPill icon={<Brain className="h-3.5 w-3.5" />} tone="brand">
            {wordsSaved.toLocaleString()}
          </StatPill>
          <StatPill icon={<BookCheck className="h-3.5 w-3.5" />} tone="neutral">
            {finishedCount}
          </StatPill>
        </div>
      </div>

      {/* Continue / all-done hero */}
      {current ? (
        <Link
          href={readHref}
          className="animate-rise group block overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-5 text-brand-fg shadow-lift sm:p-6"
        >
          <div className="flex items-center gap-4 sm:gap-5">
            <BookCover
              titleAr={current.titleAr}
              authorAr={current.authorAr}
              genre={current.genre}
              level={current.level}
              size="md"
              showBand={false}
              className="w-16 shrink-0 ring-1 ring-white/20 sm:w-20"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-fg/75">
                {firstTime ? "Start reading" : "Continue reading"}
              </p>
              <h2 className="font-serif truncate text-xl font-semibold sm:text-2xl">{current.titleEn}</h2>
              {cont && (
                <p className="font-arabic truncate text-sm text-brand-fg/80" dir="rtl">
                  {cont.chapterTitleAr}
                </p>
              )}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${cont?.pct ?? 0}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-brand-fg/80">
                {cont ? `${cont.pct}% · chapter ${cont.chapterNum} of ${cont.total}` : statusVerb(current.status)}
              </p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 transition group-hover:bg-white/25">
              <Play className="h-5 w-5 translate-x-0.5 fill-current" />
            </span>
          </div>
        </Link>
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

      <div className="mt-7 space-y-10">
        <CuratedShelf cards={curated} />
        {mine.length > 0 && <Section title="Your library" subtitle="Books you added" cards={mine} />}

        <Link
          href="/upload"
          className="flex items-center gap-4 rounded-3xl border border-dashed border-border bg-surface p-5 shadow-card transition hover:shadow-lift"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Library className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-semibold">Your library</p>
            <p className="text-sm text-fg-muted">Bring your own books — drop an EPUB to add it to your shelf.</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-fg-muted" />
        </Link>
      </div>
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

// Curated books grouped by difficulty tier so a reader can see the level they're
// at. Tiers render in order; empty tiers are skipped. The section header carries
// the tier name, so the covers themselves drop their tier chip.
function CuratedShelf({ cards }: { cards: Card[] }) {
  return (
    <>
      {TIERS.map((tier) => {
        const tierCards = cards.filter((c) => tierFor(c.level) === tier);
        if (tierCards.length === 0) return null;
        const done = tierCards.filter((c) => c.status === "completed").length;
        return (
          <Section
            key={tier}
            title={tier}
            subtitle={`${done} of ${tierCards.length} finished`}
            cards={tierCards}
            showBand={false}
          />
        );
      })}
    </>
  );
}

function Section({
  title,
  subtitle,
  cards,
  showBand,
}: {
  title: string;
  subtitle?: string;
  cards: Card[];
  showBand?: boolean;
}) {
  if (cards.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="font-serif text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <span className="ml-auto text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            {subtitle}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
        {cards.map((b) => (
          <BookTile key={b.id} book={b} showBand={showBand} />
        ))}
      </div>
    </section>
  );
}

function BookTile({ book, showBand }: { book: Card; showBand?: boolean }) {
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
          level={book.level}
          showBand={showBand ?? !book.mine}
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
