"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  Repeat,
} from "lucide-react";
import {
  answer,
  buildChoices,
  createSession,
  currentCard,
  currentMode,
  isDone,
  progress,
  qualityFor,
  type ReviewSession as Session,
} from "@maqraa/shared";
import { gradeCard, practiceCard } from "@/server/actions/review";
import { useCelebration } from "@/components/feedback/CelebrationProvider";

export type ReviewCard = {
  id: string;
  lemmaAr: string;
  glossEn: string;
  exampleAr: string | null;
  intervalDays: number;
};

type Choice = { id: string; gloss: string };

// Decks at or below this size skip the "how many?" prompt and just start.
const QUICK_START_MAX = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ReviewSession({
  initialDeck,
  pool,
  mode = "due",
}: {
  initialDeck: ReviewCard[];
  pool?: Choice[];
  mode?: "due" | "practice";
}) {
  const autoStart = initialDeck.length <= QUICK_START_MAX;
  const [limit, setLimit] = useState(autoStart ? initialDeck.length : 0);
  const [deck, setDeck] = useState<ReviewCard[]>(autoStart ? initialDeck : []);
  const [session, setSession] = useState<Session | null>(
    autoStart ? createSession(initialDeck.map((c) => c.id)) : null,
  );
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [graduated, setGraduated] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { celebrate } = useCelebration();

  const byId = useMemo(() => {
    const map: Record<string, ReviewCard> = {};
    for (const card of deck) map[card.id] = card;
    return map;
  }, [deck]);

  const choicePool = useMemo<Choice[]>(() => {
    const merged = new Map<string, Choice>();
    for (const card of initialDeck) merged.set(card.id, { id: card.id, gloss: card.glossEn });
    for (const entry of pool ?? []) merged.set(entry.id, entry);
    return [...merged.values()];
  }, [initialDeck, pool]);

  const card = session ? currentCard(session) : null;
  const cardMode = session ? currentMode(session) : null;
  const item = card ? byId[card.id] : null;
  const presentation = card ? `${card.id}:${card.attempts}` : "";

  // Options stay put while the reader is looking at them: rebuilt only when a
  // different presentation comes up.
  const [choices, setChoices] = useState<{ key: string; options: Choice[] }>({
    key: "",
    options: [],
  });
  useEffect(() => {
    if (!item || cardMode !== "choice") return;
    setChoices({
      key: presentation,
      options: buildChoices(choicePool, { id: item.id, gloss: item.glossEn }, 4),
    });
  }, [presentation, cardMode, item, choicePool]);

  // Fire the payoff once on the transition into a finished session, not on
  // every render while the done screen is up.
  const finished = session !== null && isDone(session);
  const total = session?.total ?? 0;
  const celebratedDone = useRef(false);
  useEffect(() => {
    if (!finished) {
      celebratedDone.current = false;
      return;
    }
    if (celebratedDone.current || total === 0) return;
    celebratedDone.current = true;
    celebrate("session-complete");
  }, [finished, total, celebrate]);

  function begin(size: number) {
    // The deck arrives sorted most-due-first, so the front slice is the right
    // batch; whatever's left over stays due for next time.
    const next = initialDeck.slice(0, size);
    setLimit(size);
    setDeck(next);
    setSession(createSession(next.map((c) => c.id)));
  }

  // Practice only: re-deal a freshly reshuffled batch in place (no navigation),
  // so "Practice more" always gives a different mix instead of the same cards.
  function dealMore() {
    const next = shuffle(initialDeck).slice(0, limit || initialDeck.length);
    setDeck(next);
    setSession(createSession(next.map((c) => c.id)));
    setRevealed(false);
    setPicked(null);
  }

  if (!session) {
    return <IntroScreen total={initialDeck.length} mode={mode} onPick={begin} />;
  }

  const stats = progress(session);

  if (finished) {
    const hasMore = limit < initialDeck.length || initialDeck.length >= 50;
    return (
      <DoneScreen
        totalXp={totalXp}
        mastered={stats.total}
        graduated={graduated}
        hasMore={hasMore}
        mode={mode}
        onMore={dealMore}
      />
    );
  }

  /**
   * A pass masters the word and is the only thing reported — one quality per
   * card per session. A miss just requeues it; nothing is sent, so abandoning
   * the session leaves that word due exactly as it was.
   */
  function resolve(passed: boolean, selfGrade?: number) {
    if (!session || !card) return;
    if (passed) {
      const cardId = card.id;
      const quality = qualityFor(card, selfGrade);
      startTransition(async () => {
        const res = mode === "practice" ? await practiceCard(cardId) : await gradeCard(cardId, quality);
        if ("error" in res) return;
        setTotalXp((x) => x + res.xpEarned);
        if ("graduated" in res && res.graduated) {
          setGraduated((g) => g + 1);
          celebrate("word-graduated");
        }
      });
    }
    setSession(answer(session, passed));
    setRevealed(false);
    setPicked(null);
    setChecked(false);
  }

  /** Recall reveals and commits in one press, so the cue fires here. */
  function gradeRecall(quality: number) {
    const passed = quality >= 3;
    celebrate(passed ? "answer-correct" : "answer-missed");
    resolve(passed, quality);
  }

  /**
   * Choice splits the two: picking an option only selects it, and this is
   * where the answer is committed and revealed — so the cue belongs here, not
   * on the tap and not on the Next that follows.
   */
  function checkChoice() {
    if (!item || !picked || checked) return;
    setChecked(true);
    celebrate(picked === item.id ? "answer-correct" : "answer-missed");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <Link href="/path" className="text-sm font-medium text-fg-muted transition hover:text-fg">
          ← Leave session
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {mode === "practice" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-iris/15 px-2.5 py-1 text-xs font-bold text-iris ring-1 ring-iris/30">
              Practice
            </span>
          )}
          <span className="font-bold text-fg-muted">
            {stats.mastered} / {stats.total} mastered
          </span>
          {totalXp > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent-fg ring-1 ring-accent/30">
              <Zap className="h-3 w-3" />
              {totalXp} XP
            </span>
          )}
        </div>
      </div>

      {/* Progress bar — by words mastered, not cards seen */}
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${Math.round(stats.fraction * 100)}%` }}
        />
      </div>
      <p className="mb-6 text-[11px] font-semibold text-fg-muted">
        {stats.remaining} left · missed words come back
      </p>

      {card && card.attempts > 0 && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-full bg-flame/12 px-4 py-2 text-xs font-bold text-flame ring-1 ring-flame/25">
          <Repeat className="h-3.5 w-3.5" />
          Back again — this time as multiple choice
        </div>
      )}

      {item && cardMode === "choice" ? (
        <ChoicePrompt
          item={item}
          options={choices.key === presentation ? choices.options : []}
          picked={picked}
          checked={checked}
          onPick={setPicked}
          onCheck={checkChoice}
          onNext={(correct) => resolve(correct)}
        />
      ) : item ? (
        <>
          {/* Card — tap to flip */}
          <div className="[perspective:1400px]">
            <motion.div
              onClick={() => setRevealed((r) => !r)}
              animate={{ rotateY: revealed ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative min-h-[15rem] cursor-pointer [transform-style:preserve-3d]"
            >
              {/* Front */}
              <div className="absolute inset-0 grid place-items-center rounded-3xl bg-surface p-10 text-center shadow-lift ring-1 ring-border [backface-visibility:hidden]">
                <span className="absolute right-5 top-5 rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-fg-muted ring-1 ring-border">
                  {item.intervalDays === 0 ? "new" : item.intervalDays >= 21 ? "mature" : `${item.intervalDays}d`}
                </span>
                <div>
                  <p className="font-arabic text-5xl font-bold leading-snug" dir="rtl">
                    {item.lemmaAr}
                  </p>
                  {item.exampleAr && (
                    <p className="font-arabic mt-6 text-base italic text-fg-muted" dir="rtl">
                      {item.exampleAr}
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
                    {item.lemmaAr}
                  </p>
                  <div className="mx-auto my-5 h-px w-16 bg-border" />
                  <p className="text-3xl font-extrabold">{item.glossEn}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Actions */}
          <div className="mt-5">
            {revealed && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <GradeButton onClick={() => gradeRecall(1)} disabled={isPending} tone="danger" icon={<X className="h-4 w-4" />} label="Again" />
                <GradeButton onClick={() => gradeRecall(3)} disabled={isPending} tone="flame" icon={<CheckCircle2 className="h-4 w-4" />} label="Hard" />
                <GradeButton onClick={() => gradeRecall(4)} disabled={isPending} tone="brand" icon={<CheckCircle2 className="h-4 w-4" />} label="Good" />
                <GradeButton onClick={() => gradeRecall(5)} disabled={isPending} tone="iris" icon={<Star className="h-4 w-4" />} label="Easy" />
              </div>
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}

function ChoicePrompt({
  item,
  options,
  picked,
  checked,
  onPick,
  onCheck,
  onNext,
}: {
  item: ReviewCard;
  options: Choice[];
  picked: string | null;
  checked: boolean;
  onPick: (id: string) => void;
  onCheck: () => void;
  onNext: (correct: boolean) => void;
}) {
  const correct = picked === item.id;

  return (
    <div>
      <div className="rounded-3xl bg-surface p-10 text-center shadow-lift ring-1 ring-border">
        <p className="font-arabic text-5xl font-bold leading-snug" dir="rtl">
          {item.lemmaAr}
        </p>
        {item.exampleAr && (
          <p className="font-arabic mt-4 text-base text-fg-muted" dir="rtl">
            {item.exampleAr}
          </p>
        )}
        <div className="mx-auto mt-6 h-px w-16 bg-border" />
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          What does this word mean?
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {options.map((option) => {
          const isAnswer = option.id === item.id;
          const isPicked = option.id === picked;
          // Before Check a pick is only a selection — it must not leak whether
          // it happens to be right.
          const tone = !checked
            ? isPicked
              ? "bg-brand/8 ring-2 ring-brand"
              : "bg-surface ring-border hover:bg-bg-muted"
            : isAnswer
              ? "bg-brand/8 ring-brand text-brand-dark"
              : isPicked
                ? "bg-danger/8 ring-danger"
                : "bg-surface ring-border opacity-45";
          return (
            <button
              key={option.id}
              disabled={checked}
              onClick={() => onPick(option.id)}
              className={`flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left text-[15px] font-semibold ring-1 transition ${tone}`}
            >
              <span>{option.gloss}</span>
              {checked && isAnswer && <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" />}
              {checked && isPicked && !isAnswer && <X className="h-5 w-5 shrink-0 text-danger" />}
            </button>
          );
        })}
      </div>

      <button
        onClick={checked ? () => onNext(correct) : onCheck}
        disabled={!picked}
        className="mt-5 w-full rounded-2xl bg-brand py-3.5 text-[15px] font-extrabold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:bg-bg-muted disabled:text-fg-muted disabled:shadow-none"
      >
        {!checked ? "Check" : correct ? "Next" : "Got it — keep going"}
      </button>
    </div>
  );
}

function IntroScreen({
  total,
  mode,
  onPick,
}: {
  total: number;
  mode: "due" | "practice";
  onPick: (n: number) => void;
}) {
  const presets = [10, 20, 30].filter((n) => n < total);
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-12 text-center">
      <div className="rounded-3xl bg-surface p-10 shadow-lift ring-1 ring-border">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-brand">
          <Layers className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">
          {total} words {mode === "practice" ? "to practice" : "due"}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {mode === "practice"
            ? "How many do you want to practice now? This won't change your review schedule."
            : "How many do you want to review now? The rest stay due for next time."}
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
  mastered,
  graduated,
  hasMore,
  mode,
  onMore,
}: {
  totalXp: number;
  mastered: number;
  graduated: number;
  hasMore?: boolean;
  mode: "due" | "practice";
  onMore?: () => void;
}) {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-12 text-center">
      <div className="rounded-3xl bg-surface p-10 shadow-lift ring-1 ring-border">
        <span className="animate-pop mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand text-brand-fg shadow-glow-brand">
          <Sparkles className="h-10 w-10" />
        </span>
        <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight">
          {mode === "practice" ? "Nice practice!" : "Done for today!"}
        </h1>
        <p className="mt-2 text-fg-muted">
          {mastered === 0
            ? "No cards due. Come back tomorrow."
            : `${mastered} word${mastered === 1 ? "" : "s"} mastered.`}
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
          {mode === "practice" ? (
            <>
              <button
                onClick={onMore}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
              >
                Practice more <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/path" className="text-sm font-medium text-fg-muted transition hover:text-fg">
                Back to path
              </Link>
            </>
          ) : hasMore ? (
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
