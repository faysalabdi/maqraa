import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, asc, eq, lte } from "drizzle-orm";
import ReviewSession, { type ReviewCard } from "@/components/review/ReviewSession";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/review");

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

  const deck: ReviewCard[] = dueRows.map((r) => ({
    id: r.id,
    lemmaAr: r.lemmaAr,
    glossEn: r.glossEn,
    exampleAr: r.exampleAr,
    intervalDays: r.intervalDays,
  }));

  if (deck.length === 0) {
    return <EmptyDeck />;
  }

  return <ReviewSession initialDeck={deck} />;
}

function EmptyDeck() {
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-12 text-center">
      <div className="rounded-3xl bg-white p-10 shadow-lift ring-1 ring-border">
        <span className="font-arabic mx-auto block text-5xl text-brand" dir="rtl">
          فارغ
        </span>
        <h1 className="mt-3 text-2xl font-extrabold">No cards due</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Your spaced-repetition deck is empty right now. Vocab from wrong test
          answers shows up here over time. Come back tomorrow.
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
