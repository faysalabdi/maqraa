"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Check,
  ExternalLink,
  Loader2,
  Pause,
  PartyPopper,
  Sparkles,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionize, sectionText } from "@/lib/reading/sections";
import { useWordTap, TapWords, WordSheet } from "@/components/reader/word-tap";
import {
  updateTextProgress,
  getTextSectionQuiz,
  submitTextSectionQuiz,
  type TextSectionQuiz,
  type TextSectionResult,
} from "@/server/actions/texts";
import { speakArabic, stopSpeaking, ttsAvailable } from "@/lib/tts";

type Phase = "reading" | "quiz" | "result";

export function TextReader({
  text,
  initialSavedKeys,
}: {
  text: {
    id: string;
    title: string;
    kind: string;
    level: number | null;
    sourceUrl: string | null;
    contentAr: string;
    wordCount: number;
    currentSection: number;
    completedSections: number[];
  };
  initialSavedKeys: string[];
}) {
  const wordTap = useWordTap(initialSavedKeys, { source: `text:${text.id}` });
  const sections = useMemo(() => sectionize(text.contentAr), [text.contentAr]);

  const [sectionIdx, setSectionIdx] = useState(
    Math.min(text.currentSection, sections.length - 1),
  );
  const [completed, setCompleted] = useState<Set<number>>(new Set(text.completedSections));
  const [phase, setPhase] = useState<Phase>("reading");
  const [quiz, setQuiz] = useState<TextSectionQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<TextSectionResult | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);

  const section = sections[sectionIdx];
  const isLast = sectionIdx === sections.length - 1;
  const progressPct = Math.round((completed.size / sections.length) * 100);

  useEffect(() => {
    setCanSpeak(ttsAvailable());
    return () => stopSpeaking();
  }, []);

  // Persist position whenever the section changes.
  useEffect(() => {
    updateTextProgress(text.id, sectionIdx).catch(() => {});
    stopSpeaking();
    setSpeaking(false);
    window.scrollTo({ top: 0 });
  }, [text.id, sectionIdx]);

  function goTo(idx: number) {
    setPhase("reading");
    setQuiz(null);
    setAnswers({});
    setResult(null);
    setSectionIdx(Math.max(0, Math.min(sections.length - 1, idx)));
  }

  function startQuiz() {
    setPhase("quiz");
    setAnswers({});
    setQuizLoading(true);
    getTextSectionQuiz(text.id, sectionIdx)
      .then(setQuiz)
      .catch(() => setPhase("reading"))
      .finally(() => setQuizLoading(false));
  }

  function submitQuiz() {
    if (!quiz) return;
    setQuizLoading(true);
    submitTextSectionQuiz(text.id, sectionIdx, answers)
      .then((r) => {
        setResult(r);
        setCompleted((prev) => new Set(prev).add(sectionIdx));
        setPhase("result");
      })
      .finally(() => setQuizLoading(false));
  }

  function toggleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speakArabic(sectionText(section), { onEnd: () => setSpeaking(false) });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-40 pt-4">
      {/* sticky progress header */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/texts"
            className="inline-flex shrink-0 items-center gap-1 text-sm text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Library</span>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-bg-muted ring-1 ring-border">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400"
                animate={{ width: `${progressPct}%` }}
                transition={{ type: "spring", damping: 20 }}
              />
            </div>
          </div>
          <span className="shrink-0 text-xs font-bold text-fg-muted">
            {sectionIdx + 1}/{sections.length} · {progressPct}%
          </span>
          {canSpeak && (
            <button
              onClick={toggleSpeak}
              className={cn(
                "shrink-0 rounded-full p-2 transition",
                speaking
                  ? "bg-brand text-brand-fg"
                  : "bg-bg-muted text-fg-muted hover:bg-emerald-100 hover:text-brand",
              )}
              title={speaking ? "Stop" : "Listen to this section"}
            >
              {speaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "reading" && (
          <motion.div
            key={`read-${sectionIdx}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <div className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-border sm:p-9">
              {sectionIdx === 0 && (
                <>
                  <h1 className="font-arabic mb-1 text-3xl font-bold" dir="rtl">
                    {text.title}
                  </h1>
                  <div className="mb-6 flex items-center gap-2 text-xs text-fg-muted">
                    {text.kind === "generated" && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-800">
                        AI story · level {text.level}
                      </span>
                    )}
                    {text.kind === "pdf" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
                        Your PDF
                      </span>
                    )}
                    {text.sourceUrl && (
                      <a
                        href={text.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-fg"
                      >
                        <ExternalLink className="h-3 w-3" /> source
                      </a>
                    )}
                    <span>{text.wordCount.toLocaleString()} words</span>
                  </div>
                </>
              )}

              <div className="space-y-6">
                {section.paragraphs.map((p, pi) => (
                  <TapWords key={`${sectionIdx}-${pi}`} text={p} state={wordTap} />
                ))}
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-fg-muted">
              Tap any word to translate and save it
              {wordTap.sessionSaved > 0 && (
                <> · {wordTap.sessionSaved} saved this session</>
              )}
            </p>

            {/* pager */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => goTo(sectionIdx - 1)}
                disabled={sectionIdx === 0}
                className="inline-flex items-center gap-1 rounded-2xl border border-border bg-white px-4 py-3 font-semibold transition hover:bg-bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              {completed.has(sectionIdx) ? (
                <button
                  onClick={() => (isLast ? null : goTo(sectionIdx + 1))}
                  disabled={isLast}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {isLast ? (
                    <>
                      <Check className="h-5 w-5" /> Text finished
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={startQuiz}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                >
                  <Sparkles className="h-5 w-5" /> Check my understanding
                </button>
              )}
            </div>
            {!completed.has(sectionIdx) && (
              <button
                onClick={() => goTo(sectionIdx + 1)}
                disabled={isLast}
                className="mt-2 w-full text-center text-sm text-fg-muted hover:text-fg disabled:hidden"
              >
                Skip quiz, keep reading →
              </button>
            )}
          </motion.div>
        )}

        {phase === "quiz" && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-border"
          >
            <h2 className="mb-5 text-lg font-bold">Quick check — section {sectionIdx + 1}</h2>
            {quizLoading && !quiz ? (
              <div className="flex flex-col items-center gap-3 py-10 text-fg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
                <p className="text-sm">Writing questions about what you just read…</p>
              </div>
            ) : quiz ? (
              <div className="space-y-7">
                {quiz.questions.map((q, qi) => (
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
                              ? "border-brand bg-emerald-50 ring-2 ring-brand"
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
                  onClick={submitQuiz}
                  disabled={quizLoading || Object.keys(answers).length < quiz.questions.length}
                  className="w-full rounded-2xl bg-brand py-3.5 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-50"
                >
                  {quizLoading ? "Grading…" : "Submit"}
                </button>
                <button
                  onClick={() => setPhase("reading")}
                  className="w-full text-center text-sm text-fg-muted hover:text-fg"
                >
                  ← Back to the text
                </button>
              </div>
            ) : null}
          </motion.div>
        )}

        {phase === "result" && result && quiz && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-border"
          >
            <div className="mb-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.15 }}
                className={cn(
                  "mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full",
                  result.correctCount === result.total
                    ? "bg-amber-100 text-amber-600"
                    : "bg-emerald-100 text-brand",
                )}
              >
                {result.correctCount === result.total ? (
                  <PartyPopper className="h-8 w-8" />
                ) : (
                  <Check className="h-8 w-8" />
                )}
              </motion.div>
              <h2 className="text-2xl font-extrabold">
                {result.correctCount} / {result.total}
              </h2>
              {result.xpEarned > 0 && (
                <p className="text-sm font-bold text-brand">+{result.xpEarned} XP</p>
              )}
            </div>

            <div className="space-y-3">
              {quiz.questions.map((q) => {
                const pq = result.perQuestion.find((p) => p.id === q.id);
                if (!pq) return null;
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-xl border p-3",
                      pq.correct
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-rose-200 bg-rose-50",
                    )}
                  >
                    <p className="font-arabic text-base font-semibold" dir="rtl">
                      {pq.correct ? "✓" : "✗"} {q.prompt_ar}
                    </p>
                    <p className="font-arabic mt-0.5 text-sm text-fg-muted" dir="rtl">
                      {q.choices[pq.answerIndex]} — {pq.rationaleAr}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3">
              {!isLast ? (
                <button
                  onClick={() => goTo(sectionIdx + 1)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                >
                  Next section <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  href="/texts"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                >
                  <PartyPopper className="h-4 w-4" /> Finished — back to library
                </Link>
              )}
              <Link
                href="/review"
                className="flex items-center justify-center rounded-2xl border border-border px-5 font-semibold transition hover:bg-bg-muted"
              >
                Review words
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WordSheet state={wordTap} />
    </main>
  );
}
