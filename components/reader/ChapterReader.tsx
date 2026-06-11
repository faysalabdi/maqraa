"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  Loader2,
  PartyPopper,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanWord, isArabicWord, paragraphs, tokenizeParagraph, lookupKey } from "@/lib/arabic";
import { lookupWord, saveWord } from "@/server/actions/vocab";
import {
  getChapterQuiz,
  submitChapterQuiz,
  markChapterReading,
  type ClientQuiz,
  type QuizResult,
} from "@/server/actions/chapters";
import type { WordLookup } from "@/lib/ai/word-lookup";

type Phase = "reading" | "quiz" | "result";

type Props = {
  bookSlug: string;
  bookTitleAr: string;
  chapter: {
    id: string;
    chapterNumber: number;
    titleAr: string;
    titleEn: string;
    contentAr: string;
  };
  totalChapters: number;
  nextChapterNumber: number | null;
  initialSavedKeys: string[];
  alreadyCompleted: boolean;
};

export function ChapterReader(props: Props) {
  const { chapter } = props;
  const [phase, setPhase] = useState<Phase>("reading");
  const [selected, setSelected] = useState<{ surface: string; context: string } | null>(null);
  const [lookup, setLookup] = useState<WordLookup | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set(props.initialSavedKeys));
  const [sessionSaved, setSessionSaved] = useState(0);
  const [quiz, setQuiz] = useState<ClientQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [quizLoading, setQuizLoading] = useState(false);
  const [lookupError, setLookupError] = useState(false);

  const paras = useMemo(() => paragraphs(chapter.contentAr), [chapter.contentAr]);

  useEffect(() => {
    markChapterReading(chapter.id).catch(() => {});
  }, [chapter.id]);

  function handleWordClick(surface: string, context: string) {
    if (!isArabicWord(surface)) return;
    setSelected({ surface, context });
    setLookup(null);
    setLookupError(false);
    startTransition(async () => {
      try {
        const res = await lookupWord(surface, context);
        setLookup(res);
      } catch {
        setLookupError(true);
      }
    });
  }

  function handleSave() {
    if (!lookup) return;
    const key = lookupKey(lookup.lemma_ar);
    setSavedKeys((prev) => new Set(prev).add(key).add(lookupKey(lookup.surface)));
    setSessionSaved((n) => n + 1);
    startTransition(async () => {
      await saveWord({
        lemmaAr: lookup.lemma_ar,
        glossEn: lookup.gloss_en,
        exampleAr: lookup.example_ar,
        bookSlug: props.bookSlug,
        chapterNumber: chapter.chapterNumber,
      }).catch(() => {});
    });
  }

  function startQuiz() {
    setPhase("quiz");
    setQuizLoading(true);
    getChapterQuiz(chapter.id)
      .then(setQuiz)
      .finally(() => setQuizLoading(false));
  }

  function submitQuiz() {
    if (!quiz) return;
    setQuizLoading(true);
    submitChapterQuiz(chapter.id, answers)
      .then((r) => {
        setResult(r);
        setPhase("result");
      })
      .finally(() => setQuizLoading(false));
  }

  const isLookupSaved = lookup ? savedKeys.has(lookupKey(lookup.lemma_ar)) : false;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-40 pt-6">
      {/* header */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/book/${props.bookSlug}`}
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> {props.bookTitleAr}
        </Link>
        <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-fg-muted">
          Chapter {chapter.chapterNumber} / {props.totalChapters}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {phase === "reading" && (
          <motion.div
            key="reading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-border">
              <h1 className="font-arabic mb-2 text-3xl font-bold" dir="rtl">
                {chapter.titleAr}
              </h1>
              <p className="mb-8 text-sm text-fg-muted">{chapter.titleEn}</p>

              <div className="space-y-6">
                {paras.map((p, pi) => (
                  <p
                    key={pi}
                    dir="rtl"
                    className="font-arabic text-2xl leading-loose text-fg"
                  >
                    {tokenizeParagraph(p).map((w, wi) => {
                      const known = savedKeys.has(cleanWord(w));
                      const isSelected = selected?.surface === w;
                      return (
                        <span key={wi}>
                          <span
                            onClick={() => handleWordClick(w, p)}
                            className={cn(
                              "cursor-pointer rounded-md px-0.5 transition hover:bg-amber-100",
                              known && "underline decoration-emerald-400 decoration-2 underline-offset-4",
                              isSelected && "bg-amber-200",
                            )}
                          >
                            {w}
                          </span>{" "}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={startQuiz}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-8 py-4 text-lg font-bold text-brand-fg shadow-lg shadow-emerald-200 transition hover:scale-105 hover:bg-brand-dark"
              >
                <Sparkles className="h-5 w-5" />
                {props.alreadyCompleted ? "Re-take the quiz" : "I finished — quiz me"}
              </button>
            </div>
            {sessionSaved > 0 && (
              <p className="mt-3 text-center text-sm text-fg-muted">
                {sessionSaved} new {sessionSaved === 1 ? "word" : "words"} saved this session
              </p>
            )}
          </motion.div>
        )}

        {phase === "quiz" && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-border"
          >
            <h2 className="mb-6 text-xl font-bold">Comprehension check</h2>
            {quizLoading && !quiz ? (
              <div className="flex flex-col items-center gap-3 py-12 text-fg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
                <p>Preparing your questions…</p>
              </div>
            ) : quiz ? (
              <div className="space-y-8">
                {quiz.questions.map((q, qi) => (
                  <div key={q.id}>
                    <p className="font-arabic mb-3 text-xl font-semibold" dir="rtl">
                      {qi + 1}. {q.prompt_ar}
                    </p>
                    <div className="space-y-2">
                      {q.choices.map((c, ci) => (
                        <button
                          key={ci}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: ci }))}
                          dir="rtl"
                          className={cn(
                            "font-arabic block w-full rounded-xl border px-4 py-3 text-right text-lg transition",
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
                  disabled={
                    quizLoading || Object.keys(answers).length < quiz.questions.length
                  }
                  className="w-full rounded-2xl bg-brand py-4 text-lg font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-50"
                >
                  {quizLoading ? "Grading…" : "Submit answers"}
                </button>
              </div>
            ) : (
              <p className="text-fg-muted">Could not load the quiz. Try again.</p>
            )}
          </motion.div>
        )}

        {phase === "result" && result && quiz && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-border"
          >
            <div className="mb-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className={cn(
                  "mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full",
                  result.correctCount === result.total
                    ? "bg-amber-100 text-amber-600"
                    : "bg-emerald-100 text-brand",
                )}
              >
                {result.correctCount === result.total ? (
                  <PartyPopper className="h-10 w-10" />
                ) : (
                  <Check className="h-10 w-10" />
                )}
              </motion.div>
              <h2 className="text-3xl font-extrabold">
                {result.correctCount} / {result.total}
              </h2>
              <p className="mt-1 text-fg-muted">
                {result.correctCount === result.total
                  ? "Perfect! +25 XP"
                  : "Chapter complete! +15 XP"}
              </p>
            </div>

            <div className="space-y-4">
              {quiz.questions.map((q) => {
                const pq = result.perQuestion.find((p) => p.id === q.id);
                if (!pq) return null;
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-xl border p-4",
                      pq.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
                    )}
                  >
                    <p className="font-arabic text-lg font-semibold" dir="rtl">
                      {q.prompt_ar}
                    </p>
                    <p className="font-arabic mt-1 text-base" dir="rtl">
                      {pq.correct ? "✓" : "✗"} {q.choices[pq.answerIndex]}
                    </p>
                    <p className="font-arabic mt-1 text-sm text-fg-muted" dir="rtl">
                      {pq.rationaleAr}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {props.nextChapterNumber ? (
                <Link
                  href={`/book/${props.bookSlug}/read/${props.nextChapterNumber}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-bold text-brand-fg transition hover:bg-brand-dark"
                >
                  Next chapter <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href={`/book/${props.bookSlug}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-bold text-brand-fg transition hover:bg-brand-dark"
                >
                  Book finished — back to book page
                </Link>
              )}
              <Link
                href="/review"
                className="flex flex-1 items-center justify-center rounded-2xl border border-border py-4 font-bold transition hover:bg-bg-muted"
              >
                Review saved words
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* word lookup bottom sheet */}
      <AnimatePresence>
        {selected && phase === "reading" && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-4"
          >
            <div className="rounded-3xl border border-border bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between">
                <p className="font-arabic text-2xl font-bold" dir="rtl">
                  {selected.surface}
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full p-1 text-fg-muted hover:bg-bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {isPending && !lookup ? (
                <div className="flex items-center gap-2 py-3 text-sm text-fg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Looking up…
                </div>
              ) : lookupError ? (
                <p className="py-3 text-sm text-danger">Lookup failed — tap the word again.</p>
              ) : lookup ? (
                <div className="mt-1">
                  <p className="text-lg font-semibold">{lookup.gloss_en}</p>
                  <p className="text-sm text-fg-muted">
                    <span className="font-arabic text-base" dir="rtl">
                      {lookup.lemma_ar}
                    </span>
                    {lookup.pos ? ` · ${lookup.pos}` : ""}
                  </p>
                  {lookup.example_ar && (
                    <p className="font-arabic mt-2 rounded-xl bg-bg-muted p-3 text-base" dir="rtl">
                      {lookup.example_ar}
                    </p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isLookupSaved}
                    className={cn(
                      "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold transition",
                      isLookupSaved
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-brand text-brand-fg hover:bg-brand-dark",
                    )}
                  >
                    {isLookupSaved ? (
                      <>
                        <Check className="h-4 w-4" /> Saved to your words
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-4 w-4" /> Save word (+2 XP)
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
