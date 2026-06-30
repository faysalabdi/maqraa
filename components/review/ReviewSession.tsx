"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  X,
  CheckCircle2,
  Star,
  Zap,
  Flame,
  ArrowRight,
  Layers,
} from "lucide-react";
import { gradeCard } from "@/server/actions/review";

export type ReviewCard = {
  id: string;
  lemmaAr: string;
  glossEn: string;
  exampleAr: string | null;
  intervalDays: number;
};

type Stage = "front" | "back";

// Decks at or below this size skip the "how many?" prompt and just start.
const QUICK_START_MAX = 12;

export default function ReviewSession({ initialDeck }: { initialDeck: ReviewCard[] }) {
  const autoStart = initialDeck.length <= QUICK_START_MAX;
  const [started, setStarted] = useState(autoStart);
  const [limit, setLimit] = useState(autoStart ? initialDeck.length : 0);
  const [deck, setDeck] = useState<ReviewCard[]>(autoStart ? initialDeck : []);
  const [stage, setStage] = useState<Stage>("front");
  const [totalXp, setTotalXp] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [graduated, setGraduated] = useState(0);
  const [isPending, startTransition] = useTransition();

  function begin(size: number) {
    // The deck arrives sorted most-due-first, so the front slice is the right
    // batch; whatever's left over stays due for next time.
    setLimit(size);
    setDeck(initialDeck.slice(0, size));
    setStarted(true);
  }

  if (!started) {
    return <IntroScreen total={initialDeck.length} onPick={begin} />;
  }

  const current = deck[0];

  if (!current) {
    const hasMore = limit < initialDeck.length || initialDeck.length >= 50;
    return (
      <DoneScreen totalXp={totalXp} reviewed={reviewed} graduated={graduated} hasMore={hasMore} />
    );
  }

  function grade(quality: number) {
    if (!current) return;
    startTransition(async () => {
      const res = await gradeCard(current.id, quality);
      if ("error" in res) return;
      setTotalXp((x) => x + res.xpEarned);
      setReviewed((r) => r + 1);
      if (res.graduated) setGraduated((g) => g + 1);
      setDeck((d) => d.slice(1));
      setStage("front");
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <Link
          href="/path"
          className="text-sm font-medium text-fg-muted transition hover:text-fg"
        >
          ← Leave session
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-fg-muted">
            {reviewed} / {reviewed + deck.length}
          </span>
          {totalXp > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent-fg ring-1 ring-accent/30">
              <Zap className="h-3 w-3" />
              {totalXp} XP
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{
            width: `${(reviewed / Math.max(1, reviewed + deck.length)) * 100}%`,
          }}
        />
      </div>

      {/* Card — tap to flip */}
      <div className="[perspective:1400px]">
        <motion.div
          onClick={() => setStage((s) => (s === "front" ? "back" : "front"))}
          animate={{ rotateY: stage === "back" ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-h-[15rem] cursor-pointer [transform-style:preserve-3d]"
        >
          {/* Front */}
          <div className="absolute inset-0 grid place-items-center rounded-3xl bg-surface p-10 text-center shadow-lift ring-1 ring-border [backface-visibility:hidden]">
            <span className="absolute right-5 top-5 rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-fg-muted ring-1 ring-border">
              {current.intervalDays === 0 ? "new" : current.intervalDays >= 21 ? "mature" : `${current.intervalDays}d`}
            </span>
            <div>
              <p className="font-arabic text-5xl font-bold leading-snug" dir="rtl">
                {current.lemmaAr}
              </p>
              {current.exampleAr && (
                <p className="font-arabic mt-6 text-base italic text-fg-muted" dir="rtl">
                  {current.exampleAr}
                </p>
              )}
            </div>
            <span className="absolute bottom-4 left-0 right-0 text-[11px] font-semibold uppercase tracking-widest text-fg-muted/70">
              Tap to reveal
            </span>
          </div>
          {/* Back */}
          <div className="absolute inset-0 grid place-items-center rounded-3xl bg-surface p-10 text-center shadow-lift ring-1 ring-border [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div>
              <p className="font-arabic text-3xl font-bold text-fg-muted" dir="rtl">
                {current.lemmaAr}
              </p>
              <div className="mx-auto my-5 h-px w-16 bg-border" />
              <p className="text-3xl font-extrabold">{current.glossEn}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Actions */}
      <div className="mt-5">
        {stage === "back" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <GradeButton onClick={() => grade(1)} disabled={isPending} tone="danger" icon={<X className="h-4 w-4" />} label="Again" />
            <GradeButton onClick={() => grade(3)} disabled={isPending} tone="flame" icon={<CheckCircle2 className="h-4 w-4" />} label="Hard" />
            <GradeButton onClick={() => grade(4)} disabled={isPending} tone="brand" icon={<CheckCircle2 className="h-4 w-4" />} label="Good" />
            <GradeButton onClick={() => grade(5)} disabled={isPending} tone="iris" icon={<Star className="h-4 w-4" />} label="Easy" />
          </div>
        )}
      </div>
    </main>
  );
}

function IntroScreen({ total, onPick }: { total: number; onPick: (n: number) => void }) {
  const presets = [10, 20, 30].filter((n) => n < total);
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-12 text-center">
      <div className="rounded-3xl bg-surface p-10 shadow-lift ring-1 ring-border">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-brand">
          <Layers className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">{total} words due</h1>
        <p className="mt-2 text-sm text-fg-muted">
          How many do you want to review now? The rest stay due for next time.
        </p>
        <div className="mt-6 grid gap-2">
          {presets.map((n) => (
            <button
              key={n}
              onClick={() => onPick(n)}
              className="rounded-2xl border border-border py-3 font-bold transition hover:bg-bg-muted"
            >
              {n} words
            </button>
          ))}
          <button
            onClick={() => onPick(total)}
            className="rounded-2xl bg-brand py-3 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
          >
            All {total}
          </button>
        </div>
        <Link
          href="/path"
          className="mt-5 inline-block text-sm font-medium text-fg-muted transition hover:text-fg"
        >
          Maybe later
        </Link>
      </div>
    </main>
  );
}

function GradeButton({
  onClick,
  disabled,
  tone,
  icon,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  tone: "danger" | "flame" | "brand" | "iris";
  icon: React.ReactNode;
  label: string;
}) {
  const cls =
    tone === "danger"
      ? "bg-danger shadow-glow-danger"
      : tone === "flame"
        ? "bg-flame"
        : tone === "brand"
          ? "bg-brand shadow-glow-brand"
          : "bg-iris";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-60 ${cls}`}
    >
      {icon} {label}
    </button>
  );
}

function DoneScreen({
  totalXp,
  reviewed,
  graduated,
  hasMore,
}: {
  totalXp: number;
  reviewed: number;
  graduated: number;
  hasMore?: boolean;
}) {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-12 text-center">
      <div className="rounded-3xl bg-surface p-10 shadow-lift ring-1 ring-border">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand text-brand-fg shadow-glow-brand">
          <Sparkles className="h-10 w-10" />
        </span>
        <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight">Done for today!</h1>
        <p className="mt-2 text-fg-muted">
          {reviewed === 0
            ? "No cards due. Come back tomorrow."
            : `Reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}.`}
        </p>

        {(totalXp > 0 || graduated > 0) && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {totalXp > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-4 py-2 text-sm font-bold text-accent-fg ring-1 ring-accent/30">
                <Zap className="h-4 w-4" /> +{totalXp} XP
              </span>
            )}
            {graduated > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
                <Star className="h-4 w-4" /> {graduated} graduated
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700 ring-1 ring-orange-200">
              <Flame className="h-4 w-4" /> Streak saved
            </span>
          </div>
        )}

        <div className="mt-7 flex flex-col items-center gap-3">
          {hasMore ? (
            <>
              <Link
                href="/review"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
              >
                Review more <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/path" className="text-sm font-medium text-fg-muted transition hover:text-fg">
                Back to path
              </Link>
            </>
          ) : (
            <Link
              href="/path"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
            >
              Back to path <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
