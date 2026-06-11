"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { rateCard } from "@/server/actions/vocab";
import { strengthFor, STRENGTH_META } from "@/lib/srs/strength";

export type ReviewCard = {
  id: string;
  lemmaAr: string;
  glossEn: string;
  exampleAr: string | null;
  repetitions: number;
  intervalDays: number;
  lapses: number;
  ease: number;
};

const RATINGS = [
  { label: "Again", quality: 1, key: "1", color: "bg-rose-500 hover:bg-rose-600" },
  { label: "Hard", quality: 3, key: "2", color: "bg-amber-500 hover:bg-amber-600" },
  { label: "Good", quality: 4, key: "3", color: "bg-emerald-500 hover:bg-emerald-600" },
  { label: "Easy", quality: 5, key: "4", color: "bg-sky-500 hover:bg-sky-600" },
] as const;

export function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const card = cards[index];

  const handleRate = useCallback(
    (quality: number) => {
      if (!card || !flipped) return;
      rateCard(card.id, quality).catch(() => {});
      setReviewed((n) => n + 1);
      setFlipped(false);
      if (index + 1 >= cards.length) setDone(true);
      else setIndex((i) => i + 1);
    },
    [card, flipped, index, cards.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      }
      const rating = RATINGS.find((r) => r.key === e.key);
      if (rating) handleRate(rating.quality);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRate]);

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
          className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-amber-100 text-amber-600"
        >
          <PartyPopper className="h-10 w-10" />
        </motion.div>
        <h1 className="text-3xl font-extrabold">Session complete</h1>
        <p className="mt-2 text-fg-muted">
          {reviewed} {reviewed === 1 ? "card" : "cards"} reviewed · +{reviewed} XP
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/path"
            className="rounded-2xl bg-brand px-6 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
          >
            Back to path
          </Link>
          <Link
            href="/words"
            className="rounded-2xl border border-border px-6 py-3 font-semibold transition hover:bg-bg-muted"
          >
            My words
          </Link>
        </div>
      </main>
    );
  }

  if (!card) return null;
  const strength = strengthFor(card);
  const meta = STRENGTH_META[strength];

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-10">
      <div className="mb-6 flex items-center justify-between text-sm text-fg-muted">
        <span>
          Card {index + 1} / {cards.length}
        </span>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", meta.color)}>
          {meta.labelEn}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
        <motion.div
          className="h-full bg-brand"
          animate={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <div className="perspective mt-10" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id + (flipped ? "-b" : "-f")}
            initial={{ rotateY: flipped ? -90 : 0, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
            onClick={() => setFlipped(true)}
            className="grid min-h-72 cursor-pointer place-items-center rounded-3xl bg-white p-10 text-center shadow-md ring-1 ring-border"
          >
            {!flipped ? (
              <div>
                <p className="font-arabic text-5xl font-bold" dir="rtl">
                  {card.lemmaAr}
                </p>
                <p className="mt-6 text-sm text-fg-muted">Tap or press Space to reveal</p>
              </div>
            ) : (
              <div>
                <p className="font-arabic text-3xl font-bold text-fg-muted" dir="rtl">
                  {card.lemmaAr}
                </p>
                <p className="mt-3 text-3xl font-extrabold">{card.glossEn}</p>
                {card.exampleAr && (
                  <p
                    className="font-arabic mt-4 rounded-xl bg-bg-muted p-3 text-lg"
                    dir="rtl"
                  >
                    {card.exampleAr}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8">
        {!flipped ? (
          <button
            onClick={() => setFlipped(true)}
            className="w-full rounded-2xl bg-brand py-4 text-lg font-bold text-brand-fg transition hover:bg-brand-dark"
          >
            Show answer
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.label}
                onClick={() => handleRate(r.quality)}
                className={cn(
                  "rounded-2xl py-4 font-bold text-white transition",
                  r.color,
                )}
              >
                {r.label}
                <span className="block text-[10px] font-normal opacity-80">key {r.key}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
