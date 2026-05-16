"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { submitAttempt } from "@/server/actions/tests";
import type { PublicQuestion, PerQuestionResult } from "@/server/actions/test-types";

type Props = {
  bookId: string;
  bookSlug: string;
  bookTitleAr: string;
  bookTitleEn: string;
  testId: string;
  questions: PublicQuestion[];
  isFallback: boolean;
  passageAr?: string;
};

type ResultState = {
  score: number;
  passed: boolean;
  xpEarned: number;
  perQuestion: PerQuestionResult[];
};

export default function TestRunner({
  bookId,
  bookSlug,
  bookTitleAr,
  bookTitleEn,
  testId,
  questions,
  isFallback,
  passageAr,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const q = questions[current];
  const answered = Object.keys(answers).length;
  const allAnswered = answered === questions.length;

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await submitAttempt(testId, bookId, bookSlug, answers);
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res);
      }
    });
  }

  if (result) {
    return <ResultScreen result={result} bookSlug={bookSlug} bookTitleEn={bookTitleEn} />;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link
        href={`/book/${bookSlug}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
          Comprehension Test
        </p>
        <h1 className="font-arabic mt-1 text-2xl font-bold" dir="rtl">
          {bookTitleAr}
        </h1>
        <p className="text-sm text-fg-muted">{bookTitleEn}</p>

        {isFallback && passageAr && (
          <div className="mt-4 rounded-2xl bg-bg-muted p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-fg-muted">
              Read this passage
            </p>
            <p className="font-arabic text-base leading-loose" dir="rtl">
              {passageAr}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-fg-muted">
            <span>
              Question {current + 1} of {questions.length}
            </span>
            <span>{answered} answered</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-border">
        <span className="mb-4 inline-block rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest text-fg-muted">
          {labelType(q.type)} · Q{current + 1}
        </span>

        <p className="font-arabic text-xl leading-loose" dir="rtl">
          {q.prompt_ar}
        </p>

        <div className="mt-6">
          {q.choices && q.choices.length > 0 ? (
            <div className="space-y-3">
              {q.choices.map((choice, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                    answers[q.id] === choice
                      ? "border-brand bg-brand/5 font-semibold"
                      : "border-border hover:border-brand/40 hover:bg-bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={choice}
                    checked={answers[q.id] === choice}
                    onChange={() => setAnswer(q.id, choice)}
                    className="accent-brand"
                  />
                  <span className="font-arabic text-base" dir="rtl">
                    {choice}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              rows={4}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder="اكتب إجابتك هنا..."
              dir="rtl"
              className="font-arabic w-full rounded-2xl border border-border bg-white px-4 py-3 text-base leading-loose outline-none focus:ring-2 focus:ring-brand"
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-bg-muted disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Prev
        </button>

        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => c + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-fg transition hover:bg-brand-dark"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Grading…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Submit
              </>
            )}
          </button>
        )}
      </div>

      {!allAnswered && current === questions.length - 1 && (
        <p className="mt-3 text-center text-sm text-fg-muted">
          {questions.length - answered} question{questions.length - answered !== 1 ? "s" : ""} left unanswered
        </p>
      )}
      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
    </main>
  );
}

function labelType(type: string) {
  switch (type) {
    case "mcq":
      return "Multiple choice";
    case "short":
      return "Short answer";
    case "vocab":
      return "Vocabulary";
    case "event":
      return "Thematic";
    default:
      return type;
  }
}

function ResultScreen({
  result,
  bookSlug,
  bookTitleEn,
}: {
  result: ResultState;
  bookSlug: string;
  bookTitleEn: string;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-border text-center">
        {result.passed ? (
          <CheckCircle className="mx-auto h-14 w-14 text-emerald-500" />
        ) : (
          <XCircle className="mx-auto h-14 w-14 text-danger" />
        )}

        <h1 className="mt-4 text-3xl font-extrabold">
          {result.passed ? "Passed!" : "Not quite"}
        </h1>
        <p className="mt-1 text-fg-muted">{bookTitleEn}</p>

        <p className="mt-6 text-6xl font-black">{result.score}%</p>
        <p className="mt-1 text-sm text-fg-muted">
          {result.passed ? "Needed 70% — you made it." : "Need 70% to pass."}
        </p>

        {result.xpEarned > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
            <Sparkles className="h-4 w-4" />+{result.xpEarned} XP earned
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/book/${bookSlug}`}
            className="rounded-xl border border-border px-5 py-3 font-semibold transition hover:bg-bg-muted"
          >
            Back to book
          </Link>
          {!result.passed && (
            <Link
              href={`/book/${bookSlug}/test`}
              className="rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
            >
              Try again
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="w-full rounded-2xl border border-border bg-white px-5 py-3 text-sm font-semibold transition hover:bg-bg-muted"
        >
          {showDetails ? "Hide" : "Show"} question breakdown
        </button>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-4">
          {result.perQuestion.map((pq) => (
            <div
              key={pq.id}
              className={`rounded-2xl border p-5 ${
                pq.score === 1
                  ? "border-emerald-200 bg-emerald-50"
                  : pq.score === 0.5
                    ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase text-fg-muted">
                {labelType(pq.type)} · {pq.id.toUpperCase()} ·{" "}
                {pq.score === 1 ? "Correct" : pq.score === 0.5 ? "Partial" : "Wrong"}
              </p>
              <p className="font-arabic text-base leading-loose" dir="rtl">
                {pq.prompt_ar}
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span className="font-semibold">Your answer: </span>
                  <span className="font-arabic" dir="rtl">
                    {pq.userAnswer || "—"}
                  </span>
                </p>
                {pq.score < 1 && (
                  <p>
                    <span className="font-semibold">Correct: </span>
                    <span className="font-arabic" dir="rtl">
                      {pq.correctAnswer}
                    </span>
                  </p>
                )}
                {pq.feedback_ar && (
                  <p className="font-arabic text-fg-muted" dir="rtl">
                    {pq.feedback_ar}
                  </p>
                )}
                {pq.vocab_lemma && pq.score < 1 && (
                  <span className="inline-block rounded-full bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-border">
                    vocab: {pq.vocab_lemma} → added to your review deck
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
