import Link from "next/link";
import { Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, asc, count, eq, gt, lte, sql } from "drizzle-orm";
import ReviewSession, { type ReviewCard } from "@/components/review/ReviewSession";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/review");

  const { mode } = await searchParams;
  const practice = mode === "practice";

  if (practice) {
    // Free practice: any of your words, weakest-first, regardless of due date.
    // Grading here never touches the SRS schedule (see practiceCard).
    const rows = await db
      .select({
        id: schema.vocabItems.id,
        lemmaAr: schema.vocabItems.lemmaAr,
        glossEn: schema.vocabItems.glossEn,
        exampleAr: schema.vocabItems.exampleAr,
        intervalDays: schema.vocabItems.intervalDays,
      })
      .from(schema.vocabItems)
      .where(and(eq(schema.vocabItems.userId, user.id), eq(schema.vocabItems.suspended, false)))
      // Weakest band first, but shuffled within it so each practice session
      // surfaces a different mix instead of the same cards every time.
      .orderBy(asc(schema.vocabItems.intervalDays), sql`random()`)
      .limit(100);

    if (rows.length === 0) return <NoWords />;
    return <ReviewSession initialDeck={rows} mode="practice" />;
  }

  const dueRows = await db
    .select({
      id: schema.vocabItems.id,
      lemmaAr: schema.vocabItems.lemmaAr,
      glossEn: schema.vocabItems.glossEn,
      exampleAr: schema.vocabItems.exampleAr,
      intervalDays: schema.vocabItems.intervalDays,
    })
    .from(schema.vocabItems)
    .where(
      and(
        eq(schema.vocabItems.userId, user.id),
        eq(schema.vocabItems.suspended, false),
        lte(schema.vocabItems.dueAt, new Date()),
      ),
    )
    .orderBy(asc(schema.vocabItems.dueAt))
    .limit(50);

  const deck: ReviewCard[] = dueRows;

  if (deck.length === 0) {
    // Surface when the next card is due, and whether there's anything to
    // practice, so the empty state isn't a dead-end.
    const [next] = await db
      .select({ dueAt: schema.vocabItems.dueAt })
      .from(schema.vocabItems)
      .where(
        and(
          eq(schema.vocabItems.userId, user.id),
          eq(schema.vocabItems.suspended, false),
          gt(schema.vocabItems.dueAt, new Date()),
        ),
      )
      .orderBy(asc(schema.vocabItems.dueAt))
      .limit(1);
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.vocabItems)
      .where(and(eq(schema.vocabItems.userId, user.id), eq(schema.vocabItems.suspended, false)));
    return <EmptyDeck nextDueAt={next?.dueAt ?? null} hasWords={Number(n) > 0} />;
  }

  return <ReviewSession initialDeck={deck} mode="due" />;
}

function formatUntil(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return mins <= 1 ? "in about a minute" : `in ${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours <= 1 ? "in about an hour" : `in about ${hours} hours`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "in about a day" : `in ${days} days`;
}

function EmptyDeck({ nextDueAt, hasWords }: { nextDueAt: Date | null; hasWords: boolean }) {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-12 text-center">
      <div className="rounded-3xl bg-surface p-10 shadow-lift ring-1 ring-border">
        <span className="font-arabic mx-auto block text-5xl text-brand" dir="rtl">
          فارغ
        </span>
        <h1 className="mt-3 text-2xl font-extrabold">All caught up</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {nextDueAt
            ? `No cards due right now. Your next review is ${formatUntil(nextDueAt)}.`
            : "Words you tap while reading and vocab from wrong test answers show up here when due."}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {hasWords && (
            <Link
              href="/review?mode=practice"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
            >
              <Flame className="h-4 w-4" /> Practice anyway
            </Link>
          )}
          <Link
            href={hasWords ? "/words" : "/path"}
            className="text-sm font-medium text-fg-muted transition hover:text-fg"
          >
            {hasWords ? "See my words" : "Back to path"}
          </Link>
        </div>
      </div>
    </main>
  );
}

function NoWords() {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-12 text-center">
      <div className="rounded-3xl bg-surface p-10 shadow-lift ring-1 ring-border">
        <span className="font-arabic mx-auto block text-5xl text-brand" dir="rtl">
          فارغ
        </span>
        <h1 className="mt-3 text-2xl font-extrabold">No words yet</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Open a readable book on your path and tap any word to save it — then you can practice it
          here anytime.
        </p>
        <Link
          href="/path"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
        >
          Back to path
        </Link>
      </div>
    </main>
  );
}
