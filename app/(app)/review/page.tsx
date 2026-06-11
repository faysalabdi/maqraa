import Link from "next/link";
import { and, asc, eq, lte } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { ReviewSession } from "@/components/srs/ReviewSession";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const due = await db
    .select()
    .from(schema.vocabItems)
    .where(
      and(
        eq(schema.vocabItems.userId, user.id),
        eq(schema.vocabItems.suspended, false),
        lte(schema.vocabItems.dueAt, new Date()),
      ),
    )
    .orderBy(asc(schema.vocabItems.dueAt))
    .limit(20);

  if (due.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="font-arabic text-4xl text-brand" dir="rtl">
          أَحْسَنْتَ
        </p>
        <h1 className="mt-3 text-2xl font-extrabold">Nothing due right now</h1>
        <p className="mt-2 text-fg-muted">
          Read a chapter and tap words you don&apos;t know — they&apos;ll show up here as
          flashcards when it&apos;s time to review.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/path"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
          >
            <BookOpen className="h-4 w-4" /> Go read
          </Link>
          <Link
            href="/words"
            className="rounded-2xl border border-border px-6 py-3 font-semibold transition hover:bg-bg-muted"
          >
            Browse my words
          </Link>
        </div>
      </main>
    );
  }

  return (
    <ReviewSession
      cards={due.map((c) => ({
        id: c.id,
        lemmaAr: c.lemmaAr,
        glossEn: c.glossEn,
        exampleAr: c.exampleAr,
        repetitions: c.repetitions,
        intervalDays: c.intervalDays,
        lapses: c.lapses,
        ease: Number(c.ease),
      }))}
    />
  );
}
