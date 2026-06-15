import Link from "next/link";
import { ArrowRight, Flame, Sparkles, Target, BookOpen, Hand, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookStatus } from "@/lib/db/queries/path";

export type ContinueBook = {
  slug: string;
  titleAr: string;
  titleEn: string;
  status: BookStatus;
} | null;

type Stats = {
  currentLevel: number;
  levelNameEn: string;
  levelNameAr: string;
  booksInLevel: number;
  booksRequired: number;
  xpToday: number;
  dailyGoal: number;
  streakDays: number;
  longestStreak: number;
};

function statusVerb(status: BookStatus): string {
  switch (status) {
    case "in_progress":
      return "Continue reading";
    case "reading_done":
      return "Ready to test";
    case "testing":
      return "Finish your test";
    case "failed_retry":
      return "Try the test again";
    default:
      return "Start reading";
  }
}

/**
 * The single hero at the top of the journey. It adapts to who's looking:
 * first-time readers get an oriented welcome, returning readers drop straight
 * back into the book they left.
 */
export function JourneyHero({
  mode,
  displayName,
  stats,
  currentBook,
  completedReadable,
  totalReadable,
}: {
  mode: "newcomer" | "returning" | "all_done";
  displayName: string | null;
  stats: Stats;
  currentBook: ContinueBook;
  completedReadable: number;
  totalReadable: number;
}) {
  if (mode === "newcomer") {
    return <NewcomerHero currentBook={currentBook} />;
  }
  return (
    <ReturningHero
      displayName={displayName}
      stats={stats}
      currentBook={currentBook}
      completedReadable={completedReadable}
      totalReadable={totalReadable}
    />
  );
}

function NewcomerHero({ currentBook }: { currentBook: ContinueBook }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-dark to-brand p-7 text-brand-fg shadow-lift sm:p-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
      />
      <p className="font-arabic text-5xl leading-none opacity-90" dir="rtl">
        اِقْرَأْ
      </p>
      <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight sm:text-4xl">
        Start your Arabic journey
      </h1>
      <p className="mt-2 max-w-md text-balance text-sm leading-relaxed text-brand-fg/80 sm:text-base">
        Read real books, one chapter at a time. Tap any word for an instant translation, save it
        to your deck, and pass a short check to move forward.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Step icon={<BookOpen className="h-4 w-4" />} label="Read a chapter" />
        <Step icon={<Hand className="h-4 w-4" />} label="Tap to translate" />
        <Step icon={<CircleCheck className="h-4 w-4" />} label="Pass the check" />
      </div>

      {currentBook && (
        <Link
          href={`/book/${currentBook.slug}`}
          className="group mt-6 inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-fg shadow-soft transition hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="text-left">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              Start here
            </span>
            <span className="font-arabic block text-lg font-bold leading-tight" dir="rtl">
              {currentBook.titleAr}
            </span>
          </span>
          <ArrowRight className="ml-1 h-5 w-5 text-brand transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </section>
  );
}

function Step({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-2 py-3 text-center">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">{icon}</span>
      <span className="text-[11px] font-semibold leading-tight sm:text-xs">{label}</span>
    </div>
  );
}

function ReturningHero({
  displayName,
  stats,
  currentBook,
  completedReadable,
  totalReadable,
}: {
  displayName: string | null;
  stats: Stats;
  currentBook: ContinueBook;
  completedReadable: number;
  totalReadable: number;
}) {
  const name = displayName?.split("@")[0] ?? null;
  const goalProgress = Math.min(100, Math.round((stats.xpToday / Math.max(1, stats.dailyGoal)) * 100));
  const levelProgress =
    stats.booksRequired >= 99
      ? null
      : Math.min(100, Math.round((stats.booksInLevel / stats.booksRequired) * 100));

  return (
    <section className="rounded-3xl bg-white p-5 shadow-lift ring-1 ring-border sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg-muted">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold leading-tight">
            Stage {stats.currentLevel} · {stats.levelNameEn}
          </h1>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand/10 ring-1 ring-brand/20">
          <span className="font-arabic text-2xl font-black text-brand">{stats.currentLevel}</span>
        </div>
      </div>

      {currentBook ? (
        <Link
          href={`/book/${currentBook.slug}`}
          className="group mt-4 flex items-center gap-4 rounded-2xl bg-brand p-4 text-brand-fg shadow-glow-brand transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <BookOpen className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-fg/75">
              {statusVerb(currentBook.status)}
            </span>
            <span className="font-arabic block truncate text-xl font-bold leading-tight" dir="rtl">
              {currentBook.titleAr}
            </span>
            <span className="block truncate text-xs text-brand-fg/75">{currentBook.titleEn}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <div className="mt-4 rounded-2xl bg-bg-muted p-4 text-center">
          <p className="text-sm font-semibold text-fg">
            {completedReadable >= totalReadable && totalReadable > 0
              ? "You've finished every book available right now."
              : "Pick a book below to begin."}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            More titles are added over time — keep your streak alive with a review.
          </p>
          <Link
            href="/review"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
          >
            Review vocabulary <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Stage"
          value={`${stats.booksInLevel}/${stats.booksRequired >= 99 ? "∞" : stats.booksRequired}`}
          progress={levelProgress}
          tone="brand"
        />
        <StatTile
          icon={<Target className="h-4 w-4" />}
          label="Daily goal"
          value={`${stats.xpToday}/${stats.dailyGoal}`}
          progress={goalProgress}
          tone="amber"
        />
        <StatTile
          icon={<Flame className="h-4 w-4" />}
          label={`Best ${stats.longestStreak}d`}
          value={`${stats.streakDays}d`}
          progress={null}
          tone={stats.streakDays > 0 ? "flame" : "neutral"}
        />
      </div>
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
  progress,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  progress: number | null;
  tone: "brand" | "amber" | "flame" | "neutral";
}) {
  const bar =
    tone === "brand"
      ? "bg-brand"
      : tone === "amber"
        ? "bg-accent"
        : tone === "flame"
          ? "bg-flame"
          : "bg-fg-muted";
  const ink =
    tone === "brand"
      ? "text-brand"
      : tone === "amber"
        ? "text-accent-fg"
        : tone === "flame"
          ? "text-flame"
          : "text-fg-muted";

  return (
    <div className="rounded-2xl bg-bg-muted p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
        <span className={ink}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-lg font-extrabold leading-none text-fg">{value}</p>
      {progress !== null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
