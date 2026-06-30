import Link from "next/link";
import { ArrowRight, Compass, Flame, Lock, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeIcon } from "@/components/achievements/icons";
import type { SummaryBadge } from "@/lib/achievements/server";

export function StageCard({
  level,
  nameEn,
  nameAr,
  booksInLevel,
  booksRequired,
  nextName,
}: {
  level: number;
  nameEn: string;
  nameAr: string;
  booksInLevel: number;
  booksRequired: number;
  nextName: string | null;
}) {
  const pct = booksRequired > 0 ? Math.min(100, (booksInLevel / booksRequired) * 100) : 100;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-brand/15 to-surface p-6 shadow-card ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            <Compass className="h-3 w-3 text-brand" /> Your stage
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight">{nameEn}</h2>
          <p className="font-arabic text-base text-fg-muted" dir="rtl">
            {nameAr}
          </p>
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-fg shadow-glow-brand">
          <span className="text-xl font-black">{level}</span>
        </span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-bg-muted">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="font-semibold">
          {booksInLevel} of {booksRequired} <span className="text-fg-muted">books to clear</span>
        </span>
        {nextName && (
          <span className="inline-flex items-center gap-1 font-semibold text-brand">
            Next: {nextName} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

const MILESTONES = [
  { days: 7, name: "Week Warrior" },
  { days: 14, name: "Devoted" },
  { days: 30, name: "Month Marathon" },
];

export function StreakBanner({
  current,
  longest,
  freezes,
}: {
  current: number;
  longest: number;
  freezes: number;
}) {
  const next = MILESTONES.find((m) => m.days > current);
  const prev = [...MILESTONES].reverse().find((m) => m.days <= current);
  const base = prev?.days ?? 0;
  const pct = next ? Math.min(100, ((current - base) / (next.days - base)) * 100) : 100;

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-flame/15 text-flame">
          <Flame className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-extrabold leading-none">
            {current} <span className="text-base font-bold text-fg-muted">days</span>
          </p>
          <p className="mt-1 text-xs text-fg-muted">Longest: {longest} days</p>
        </div>
        <div className="min-w-[12rem] flex-1">
          {next ? (
            <>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>
                  Next milestone: <span className="text-flame">{next.name}</span> · {next.days} days
                </span>
                <span className="text-fg-muted">{next.days - current} to go</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg-muted">
                <div
                  className="h-full rounded-full bg-flame transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold text-flame">
              Every milestone cleared — you&apos;re on a marathon.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-bg-muted px-3 py-2">
        <Snowflake className="h-4 w-4 text-iris" />
        <span className="text-sm font-bold">{freezes} freezes</span>
        <span className="text-xs text-fg-muted">auto-protects a missed day</span>
      </div>
    </div>
  );
}

export function AchievementsPreview({
  items,
  earnedCount,
  total,
  xpEarned,
}: {
  items: SummaryBadge[];
  earnedCount: number;
  total: number;
  xpEarned: number;
}) {
  return (
    <section className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Achievements</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {earnedCount} of {total} earned · {xpEarned.toLocaleString()} XP banked
          </p>
        </div>
        <Link
          href="/achievements"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline"
        >
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-2">
        {items.map((a) => (
          <div
            key={a.slug}
            title={`${a.nameEn}${a.earned ? "" : " · locked"}`}
            className={cn(
              "relative grid aspect-square place-items-center rounded-2xl ring-1",
              a.earned
                ? "bg-brand/15 text-brand ring-brand/30"
                : "bg-bg-muted text-fg-muted/50 ring-border",
            )}
          >
            <BadgeIcon name={a.icon} className="h-6 w-6" />
            {!a.earned && (
              <span className="absolute bottom-1 right-1 text-fg-muted/60">
                <Lock className="h-3 w-3" />
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
