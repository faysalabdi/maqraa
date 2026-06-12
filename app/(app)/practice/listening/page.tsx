"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Headphones, Loader2, PartyPopper, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getListeningExercise,
  submitListening,
  type ClientListeningExercise,
  type ListeningResult,
} from "@/server/actions/listening";
import { speakArabic, stopSpeaking } from "@/lib/tts";

type Phase = "idle" | "listening" | "result";

export default function ListeningPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [exercise, setExercise] = useState<ClientListeningExercise | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ListeningResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);

  async function start() {
    setBusy(true);
    try {
      const ex = await getListeningExercise();
      setExercise(ex);
      setAnswers({});
      setResult(null);
      setPlays(0);
      setPhase("listening");
    } finally {
      setBusy(false);
    }
  }

  function play() {
    if (!exercise) return;
    stopSpeaking();
    setPlaying(true);
    setPlays((n) => n + 1);
    speakArabic(exercise.passageAr, { rate: 0.8, onEnd: () => setPlaying(false) });
  }

  async function submit() {
    if (!exercise) return;
    setBusy(true);
    stopSpeaking();
    try {
      setResult(await submitListening(exercise.id, answers));
      setPhase("result");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link
        href="/practice"
        className="mb-6 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Practice
      </Link>

      {phase === "idle" && (
        <div className="rounded-3xl bg-white p-10 text-center shadow-soft ring-1 ring-border">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-sky-500 text-white shadow-soft">
            <Headphones className="h-8 w-8" />
          </span>
          <h1 className="text-2xl font-extrabold">Listening practice</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            You&apos;ll hear a short Arabic passage — the text stays hidden. Listen as many
            times as you need, then answer 3 questions. The passage is revealed after you
            answer.
          </p>
          <button
            onClick={start}
            disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            {busy ? "Preparing…" : "Start"}
          </button>
          <p className="mt-3 text-xs text-fg-muted">
            Uses your device&apos;s Arabic voice. Best on phones and Macs.
          </p>
        </div>
      )}

      {phase === "listening" && exercise && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-5 rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-border">
            <p className="text-xs font-bold uppercase tracking-widest text-fg-muted">
              {exercise.topic}
            </p>
            <button
              onClick={play}
              disabled={playing}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-6 py-3.5 font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {playing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : plays === 0 ? (
                <Play className="h-5 w-5" />
              ) : (
                <RotateCcw className="h-5 w-5" />
              )}
              {playing ? "Playing…" : plays === 0 ? "Play the passage" : `Play again (${plays})`}
            </button>
          </div>

          <div className="space-y-6 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-border">
            {exercise.questions.map((q, qi) => (
              <div key={q.id}>
                <p className="font-arabic mb-2.5 text-xl font-semibold" dir="rtl">
                  {qi + 1}. {q.prompt_ar}
                </p>
                <div className="space-y-2">
                  {q.choices.map((c, ci) => (
                    <button
                      key={ci}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: ci }))}
                      dir="rtl"
                      className={cn(
                        "font-arabic block w-full rounded-xl border px-4 py-2.5 text-right text-lg transition",
                        answers[q.id] === ci
                          ? "border-sky-500 bg-sky-50 ring-2 ring-sky-400"
                          : "border-border hover:bg-bg-muted",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={submit}
              disabled={busy || Object.keys(answers).length < exercise.questions.length}
              className="w-full rounded-2xl bg-sky-600 py-3.5 font-bold text-white transition hover:bg-sky-700 disabled:opacity-50"
            >
              {busy ? "Grading…" : "Submit answers"}
            </button>
          </div>
        </motion.div>
      )}

      {phase === "result" && result && exercise && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-border"
        >
          <div className="mb-6 text-center">
            <span
              className={cn(
                "mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full",
                result.passed ? "bg-emerald-100 text-brand" : "bg-rose-100 text-rose-600",
              )}
            >
              {result.passed ? <PartyPopper className="h-8 w-8" /> : <Check className="h-8 w-8" />}
            </span>
            <h2 className="text-2xl font-extrabold">
              {result.correctCount} / {result.total}
            </h2>
            {result.xpEarned > 0 && (
              <p className="text-sm font-bold text-brand">+{result.xpEarned} XP</p>
            )}
          </div>

          <div className="rounded-2xl bg-bg-muted p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-fg-muted">
              What you heard
            </p>
            <p className="font-arabic text-xl leading-loose" dir="rtl">
              {exercise.passageAr}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {exercise.questions.map((q) => {
              const pq = result.perQuestion.find((p) => p.id === q.id);
              if (!pq) return null;
              return (
                <div
                  key={q.id}
                  className={cn(
                    "rounded-xl border p-3",
                    pq.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
                  )}
                >
                  <p className="font-arabic text-base" dir="rtl">
                    {pq.correct ? "✓" : "✗"} {q.prompt_ar} — {q.choices[pq.answerIndex]}
                  </p>
                </div>
              );
            })}
          </div>

          <button
            onClick={start}
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-sky-600 py-3.5 font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Another one"}
          </button>
        </motion.div>
      )}
    </main>
  );
}
