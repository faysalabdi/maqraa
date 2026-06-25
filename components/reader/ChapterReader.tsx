"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  PartyPopper,
  Plus,
  Type,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanWord, isArabicWord, paragraphs, tokenizeParagraph, lookupKey } from "@/lib/arabic";
import { lookupWord, saveWord } from "@/server/actions/vocab";
import {
  getChapterQuiz,
  submitChapterQuiz,
  markChapterReading,
  markChapterRead,
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
  chapterList: { n: number; titleAr: string; titleEn: string }[];
  nextChapterNumber: number | null;
  initialSavedKeys: string[];
  alreadyCompleted: boolean;
};

const TINTS = {
  paper: { name: "Paper", page: "var(--read-page)", ink: "var(--read-ink)" },
  sepia: { name: "Sepia", page: "#f6efdc", ink: "#3a2f1c" },
  mint: { name: "Mint", page: "#e8f3ec", ink: "#1f3b30" },
} as const;
type TintKey = keyof typeof TINTS;
const SIZES = [1.25, 1.4, 1.6, 1.8, 2.05];
const PAGE_CHARS = 1100; // target characters per on-screen page

export function ChapterReader(props: Props) {
  const { chapter } = props;
  const router = useRouter();
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
  const [finishing, setFinishing] = useState(false);

  const [sizeIdx, setSizeIdx] = useState(2);
  const [tint, setTint] = useState<TintKey>("paper");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const readMarked = useRef(false);

  // Split the chapter into screen-sized pages, keeping paragraphs whole.
  const pages = useMemo(() => {
    const paras = paragraphs(chapter.contentAr);
    const out: string[][] = [];
    let cur: string[] = [];
    let len = 0;
    for (const p of paras) {
      if (len > 0 && len + p.length > PAGE_CHARS) {
        out.push(cur);
        cur = [];
        len = 0;
      }
      cur.push(p);
      len += p.length;
    }
    if (cur.length) out.push(cur);
    return out.length ? out : [[]];
  }, [chapter.contentAr]);

  const lastPage = pageIdx >= pages.length - 1;
  const isLastChapter = props.nextChapterNumber === null;

  useEffect(() => {
    markChapterReading(chapter.id).catch(() => {});
  }, [chapter.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("reader-prefs");
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.sizeIdx === "number") setSizeIdx(Math.max(0, Math.min(SIZES.length - 1, p.sizeIdx)));
        if (p.tint && p.tint in TINTS) setTint(p.tint);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("reader-prefs", JSON.stringify({ sizeIdx, tint }));
    } catch {}
  }, [sizeIdx, tint]);

  // Reaching the last page = finished reading this chapter.
  useEffect(() => {
    if (lastPage && !readMarked.current) {
      readMarked.current = true;
      markChapterRead(chapter.id).catch(() => {});
    }
  }, [lastPage, chapter.id]);

  function goPage(next: number) {
    setSelected(null);
    setPageIdx(Math.max(0, Math.min(pages.length - 1, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleWordClick(surface: string, context: string) {
    if (!isArabicWord(surface)) return;
    setSelected({ surface, context });
    setLookup(null);
    setLookupError(false);
    startTransition(async () => {
      try {
        setLookup(await lookupWord(surface, context));
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
    setSelected(null);
    setPhase("quiz");
    setQuizLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  function finishBook() {
    setFinishing(true);
    markChapterRead(chapter.id)
      .catch(() => {})
      .finally(() => router.push(`/book/${props.bookSlug}`));
  }

  const isLookupSaved = lookup ? savedKeys.has(lookupKey(lookup.lemma_ar)) : false;
  const t = TINTS[tint];
  const bodySize = SIZES[sizeIdx];
  const pageProgress = Math.round(((pageIdx + 1) / pages.length) * 100);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
          <Link
            href={`/book/${props.bookSlug}`}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-arabic max-w-[7rem] truncate" dir="rtl">
              {props.bookTitleAr}
            </span>
          </Link>
          <div className="mx-auto flex items-center gap-2">
            <div className="relative">
              <select
                value={chapter.chapterNumber}
                onChange={(e) => router.push(`/book/${props.bookSlug}/read/${e.target.value}`)}
                aria-label="Jump to chapter"
                className="max-w-[11rem] cursor-pointer truncate rounded-full bg-bg-muted py-1 pl-3 pr-7 text-xs font-semibold text-fg-muted outline-none transition hover:bg-border focus:ring-2 focus:ring-brand/30"
              >
                {props.chapterList.map((c) => (
                  <option key={c.n} value={c.n}>
                    {c.n}. {c.titleEn || `Chapter ${c.n}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
            </div>
            {phase === "reading" && pages.length > 1 && (
              <span className="hidden shrink-0 rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-fg-muted sm:inline">
                p{pageIdx + 1}/{pages.length}
              </span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setPrefsOpen((o) => !o)}
              aria-label="Reading settings"
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full transition",
                prefsOpen ? "bg-brand text-brand-fg" : "text-fg-muted hover:bg-bg-muted hover:text-fg",
              )}
            >
              <Type className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {prefsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  className="absolute right-0 top-11 z-40 w-60 rounded-2xl border border-border bg-surface p-3 shadow-lift"
                >
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Text size
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSizeIdx((i) => Math.max(0, i - 1))}
                      className="grid h-9 flex-1 place-items-center rounded-xl bg-bg-muted text-fg-muted transition hover:bg-border"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold">{sizeIdx + 1}</span>
                    <button
                      onClick={() => setSizeIdx((i) => Math.min(SIZES.length - 1, i + 1))}
                      className="grid h-9 flex-1 place-items-center rounded-xl bg-bg-muted text-fg-muted transition hover:bg-border"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Page
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(TINTS) as TintKey[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => setTint(k)}
                        className={cn(
                          "rounded-xl border-2 px-2 py-2 text-xs font-semibold transition",
                          tint === k ? "border-brand" : "border-border hover:border-fg-muted",
                        )}
                        style={{ background: TINTS[k].page }}
                      >
                        {TINTS[k].name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {phase === "reading" && (
          <div className="h-0.5 w-full bg-border/50">
            <div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${pageProgress}%` }} />
          </div>
        )}
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-40 pt-6" onClick={() => prefsOpen && setPrefsOpen(false)}>
        <AnimatePresence mode="wait">
          {phase === "reading" && (
            <motion.div key={`reading-${pageIdx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <article
                className="rounded-[1.75rem] px-6 py-10 shadow-card ring-1 ring-border/70 sm:px-12 sm:py-14"
                style={{ background: t.page, color: t.ink }}
              >
                {pageIdx === 0 && (
                  <header className="mb-10 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-50">
                      Chapter {chapter.chapterNumber}
                    </p>
                    <h1 className="font-arabic mt-3 text-3xl font-bold leading-snug sm:text-4xl" dir="rtl">
                      {chapter.titleAr}
                    </h1>
                    {chapter.titleEn && <p className="mt-2 text-sm opacity-60">{chapter.titleEn}</p>}
                    <div className="mt-6 flex items-center justify-center gap-3 opacity-40">
                      <span className="h-px w-12 bg-current" />
                      <span className="text-lg leading-none">۞</span>
                      <span className="h-px w-12 bg-current" />
                    </div>
                  </header>
                )}

                <div className="space-y-6">
                  {pages[pageIdx].map((p, pi) => (
                    <p key={pi} dir="rtl" className="font-arabic" style={{ fontSize: `${bodySize}rem`, lineHeight: 2.1 }}>
                      {tokenizeParagraph(p).map((w, wi) => {
                        const known = savedKeys.has(cleanWord(w));
                        const isSel = selected?.surface === w;
                        return (
                          <span key={wi}>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWordClick(w, p);
                              }}
                              className={cn(
                                "cursor-pointer rounded px-0.5 transition hover:bg-accent-soft",
                                known && "underline decoration-brand decoration-2 underline-offset-[6px]",
                                isSel && "bg-accent-soft ring-1 ring-accent/40",
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
              </article>

              {/* Page navigation */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={() => goPage(pageIdx - 1)}
                  disabled={pageIdx === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="text-xs font-semibold text-fg-muted">
                  Page {pageIdx + 1} of {pages.length}
                </span>
                {!lastPage ? (
                  <button
                    onClick={() => goPage(pageIdx + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="w-[5.5rem]" />
                )}
              </div>

              {/* End of chapter */}
              {lastPage && (
                <div className="mt-6 rounded-2xl bg-surface p-5 text-center shadow-card ring-1 ring-border">
                  <p className="text-sm font-semibold text-fg-muted">
                    {isLastChapter ? "You finished the book 🎉" : `End of chapter ${chapter.chapterNumber}`}
                  </p>
                  <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    {isLastChapter ? (
                      <>
                        <button
                          onClick={finishBook}
                          disabled={finishing}
                          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-60"
                        >
                          {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                          Finish book
                        </button>
                        <Link
                          href={`/book/${props.bookSlug}/test`}
                          className="text-sm font-semibold text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                        >
                          Test your comprehension (optional)
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/book/${props.bookSlug}/read/${props.nextChapterNumber}`}
                          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
                        >
                          Next chapter <ArrowRight className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={startQuiz}
                          className="text-sm font-semibold text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                        >
                          Quiz me on this chapter (optional)
                        </button>
                      </>
                    )}
                  </div>
                  {sessionSaved > 0 && (
                    <p className="mt-3 text-xs text-fg-muted">
                      {sessionSaved} new {sessionSaved === 1 ? "word" : "words"} saved this session
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {phase === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-[1.75rem] bg-surface p-8 shadow-card ring-1 ring-border/70"
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
                                ? "border-brand bg-brand/10 ring-2 ring-brand"
                                : "border-border hover:bg-bg-muted",
                            )}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPhase("reading")}
                      className="rounded-2xl border border-border px-5 py-4 font-bold transition hover:bg-bg-muted"
                    >
                      Back
                    </button>
                    <button
                      onClick={submitQuiz}
                      disabled={quizLoading || Object.keys(answers).length < quiz.questions.length}
                      className="flex-1 rounded-2xl bg-brand py-4 text-lg font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-50"
                    >
                      {quizLoading ? "Grading…" : "Submit answers"}
                    </button>
                  </div>
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
              className="rounded-[1.75rem] bg-surface p-8 shadow-card ring-1 ring-border/70"
            >
              <div className="mb-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className={cn(
                    "mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full",
                    result.correctCount === result.total ? "bg-accent/20 text-accent-fg" : "bg-brand/15 text-brand",
                  )}
                >
                  {result.correctCount === result.total ? <PartyPopper className="h-10 w-10" /> : <Check className="h-10 w-10" />}
                </motion.div>
                <h2 className="text-3xl font-extrabold">
                  {result.correctCount} / {result.total}
                </h2>
                <p className="mt-1 text-fg-muted">
                  {result.correctCount === result.total ? "Perfect!" : "Nice work"}
                </p>
              </div>

              <div className="space-y-4">
                {quiz.questions.map((q) => {
                  const pq = result.perQuestion.find((p) => p.id === q.id);
                  if (!pq) return null;
                  return (
                    <div
                      key={q.id}
                      className={cn("rounded-xl border p-4", pq.correct ? "border-brand/30 bg-brand/5" : "border-rose-200 bg-rose-50")}
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
                    href={`/book/${props.bookSlug}/test`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-bold text-brand-fg transition hover:bg-brand-dark"
                  >
                    Finish book — take the test
                  </Link>
                )}
                <Link
                  href={`/book/${props.bookSlug}`}
                  className="flex flex-1 items-center justify-center rounded-2xl border border-border py-4 font-bold transition hover:bg-bg-muted"
                >
                  Back to book
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selected && phase === "reading" && (
          <motion.div
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl px-4 pb-4"
          >
            <div className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-lift">
              <div className="flex items-start justify-between">
                <p className="font-arabic text-3xl font-bold" dir="rtl">
                  {selected.surface}
                </p>
                <button onClick={() => setSelected(null)} className="rounded-full p-1.5 text-fg-muted transition hover:bg-bg-muted">
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
                      isLookupSaved ? "bg-brand/15 text-brand" : "bg-brand text-brand-fg hover:bg-brand-dark",
                    )}
                  >
                    {isLookupSaved ? (
                      <>
                        <Check className="h-4 w-4" /> Saved to your words
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-4 w-4" /> Save word · +2 XP
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
