"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
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
  retryTextExtraction,
  type TextSectionQuiz,
  type TextSectionResult,
} from "@/server/actions/texts";
import { speakArabic, stopSpeaking, ttsAvailable } from "@/lib/tts";

type Phase = "reading" | "quiz" | "result";

type ExtractionStatus = "ready" | "processing" | "failed";

// Mirrors OCR_KEY_MISSING_ERROR in lib/texts/extract-job.ts — a config problem
// (no Mistral API key) rather than a bad PDF, so it gets its own panel.
const OCR_KEY_MISSING_ERROR = "ocr-key-missing";

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
    extractionStatus: ExtractionStatus;
    extractionError: string | null;
    pagesTotal: number | null;
    pagesDone: number;
  };
  initialSavedKeys: string[];
}) {
  const router = useRouter();
  const isProcessing = text.extractionStatus === "processing";
  const isFailed = text.extractionStatus === "failed";
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
  const [quizError, setQuizError] = useState<string | null>(null);
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

  // While a PDF is still being read in the background, poll the server so newly
  // extracted pages appear automatically.
  useEffect(() => {
    if (!isProcessing) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [isProcessing, router]);

  // A single vision read of 12 dense pages can take several minutes, so quiet
  // periods are normal — but if nothing lands for this long, offer a resume.
  const STALL_AFTER_MS = 10 * 60_000;
  const [stalled, setStalled] = useState(false);
  const lastProgress = useRef({ pages: text.pagesDone, at: Date.now() });
  useEffect(() => {
    if (!isProcessing) return;
    if (text.pagesDone !== lastProgress.current.pages) {
      lastProgress.current = { pages: text.pagesDone, at: Date.now() };
      setStalled(false);
    }
    const t = setInterval(
      () => setStalled(Date.now() - lastProgress.current.at > STALL_AFTER_MS),
      20_000,
    );
    return () => clearInterval(t);
  }, [isProcessing, text.pagesDone, STALL_AFTER_MS]);

  const [retrying, setRetrying] = useState(false);
  function retry() {
    setRetrying(true);
    lastProgress.current = { pages: text.pagesDone, at: Date.now() };
    setStalled(false);
    retryTextExtraction(text.id)
      .then(() => router.refresh())
      .finally(() => setRetrying(false));
  }

  function goTo(idx: number) {
    setPhase("reading");
    setQuiz(null);
    setAnswers({});
    setResult(null);
    setQuizError(null);
    setSectionIdx(Math.max(0, Math.min(sections.length - 1, idx)));
  }

  function startQuiz() {
    setPhase("quiz");
    setAnswers({});
    setQuiz(null);
    setQuizError(null);
    setQuizLoading(true);
    getTextSectionQuiz(text.id, sectionIdx)
      .then(setQuiz)
      .catch(() => setQuizError("Couldn't load the check — please try again."))
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

  const hasContent = text.contentAr.trim().length > 0;
  const pagePct =
    text.pagesTotal && text.pagesTotal > 0
      ? Math.min(100, Math.round((text.pagesDone / text.pagesTotal) * 100))
      : 0;

  // Full-screen states for a PDF that isn't readable yet.
  if (!hasContent && (isProcessing || isFailed)) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-10">
        <Link
          href="/texts"
          className="mb-6 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
        <div className="rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-border">
          {isFailed && text.extractionError === OCR_KEY_MISSING_ERROR ? (
            <>
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
              <h1 className="mt-4 text-2xl font-extrabold">OCR isn&apos;t set up yet</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
                This is a scanned PDF with no text layer, so it needs OCR to read.
                Add a <span className="font-semibold">MISTRAL_API_KEY</span> in your
                environment (get one at{" "}
                <a
                  href="https://console.mistral.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand underline"
                >
                  console.mistral.ai
                </a>
                ), then tap retry. PDFs that already have selectable text don&apos;t
                need a key.
              </p>
              <button
                onClick={retry}
                disabled={retrying}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
              >
                {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Retry
              </button>
            </>
          ) : isFailed ? (
            <>
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
              <h1 className="mt-4 text-2xl font-extrabold">Couldn&apos;t read this PDF</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
                {text.extractionError ??
                  "Something went wrong while reading your PDF."}
              </p>
              <button
                onClick={retry}
                disabled={retrying}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
              >
                {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Try again
              </button>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand" />
              <h1 className="mt-4 text-2xl font-extrabold">Cleaning up your PDF…</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
                Repairing{" "}
                {text.pagesTotal ? `all ${text.pagesTotal} pages` : "the pages"} so the
                Arabic reads in the right order. New pages appear here as they finish —
                you can close this tab and come back later; the job keeps running.
              </p>
              <div className="mx-auto mt-6 h-2.5 max-w-xs overflow-hidden rounded-full bg-bg-muted ring-1 ring-border">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400"
                  animate={{ width: `${Math.max(6, pagePct)}%` }}
                  transition={{ type: "spring", damping: 20 }}
                />
              </div>
              {text.pagesTotal ? (
                <p className="mt-2 text-xs font-bold text-fg-muted">
                  {text.pagesDone} / {text.pagesTotal} pages
                </p>
              ) : null}
              {stalled && (
                <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
                  <p className="font-semibold">
                    No progress for a while — the job may have stalled.
                  </p>
                  <button
                    onClick={retry}
                    disabled={retrying}
                    className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
                  >
                    {retrying ? "Resuming…" : "Resume extraction"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-40 pt-4">
      {(isProcessing || isFailed) && (
        <div
          className={cn(
            "mb-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1",
            isFailed
              ? "bg-amber-50 text-amber-900 ring-amber-200"
              : "bg-sky-50 text-sky-900 ring-sky-200",
          )}
        >
          {isFailed ? (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          ) : (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          )}
          <div className="min-w-0 flex-1">
            {isFailed ? (
              <>
                <p className="font-semibold">
                  Extraction stopped early — some pages may be missing.
                </p>
                {text.extractionError &&
                  text.extractionError !== OCR_KEY_MISSING_ERROR && (
                    <p className="mt-1 break-words text-xs leading-snug opacity-80">
                      {text.extractionError}
                    </p>
                  )}
              </>
            ) : (
              <p className="font-semibold">
                Still reading the rest of your PDF
                {text.pagesTotal ? ` · ${text.pagesDone}/${text.pagesTotal} pages` : ""} —
                new pages appear as they&apos;re ready.
              </p>
            )}
          </div>
          {(isFailed || stalled) && (
            <button
              onClick={retry}
              disabled={retrying}
              className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
            >
              {retrying ? "Resuming…" : "Resume"}
            </button>
          )}
        </div>
      )}
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

              {!isLast ? (
                // Mid-book: advance freely. The comprehension check is optional.
                <button
                  onClick={() => goTo(sectionIdx + 1)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : isProcessing ? (
                // The trailing section can still grow as more pages arrive.
                <button
                  disabled
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-bg-muted py-3.5 font-bold text-fg-muted"
                >
                  <Loader2 className="h-5 w-5 animate-spin" /> More pages loading…
                </button>
              ) : completed.has(sectionIdx) ? (
                // Final check already passed — the whole text is done.
                <Link
                  href="/texts"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-glow-brand transition hover:bg-emerald-600"
                >
                  <Check className="h-5 w-5" /> Text finished
                </Link>
              ) : (
                // Required check at the end of the book.
                <button
                  onClick={startQuiz}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                >
                  <Sparkles className="h-5 w-5" /> Finish — check understanding
                </button>
              )}
            </div>
            {!isLast && (
              <button
                onClick={startQuiz}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-sm text-fg-muted transition hover:text-brand"
              >
                <Sparkles className="h-3.5 w-3.5" /> Check my understanding (optional)
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
            <h2 className="mb-5 text-lg font-bold">
              {isLast ? "Final check — pass to finish" : `Quick check — section ${sectionIdx + 1}`}
            </h2>
            {quizError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <p className="text-sm text-fg-muted">{quizError}</p>
                <div className="flex gap-2">
                  <button
                    onClick={startQuiz}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => setPhase("reading")}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-bg-muted"
                  >
                    Back to the text
                  </button>
                </div>
              </div>
            ) : quizLoading && !quiz ? (
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
