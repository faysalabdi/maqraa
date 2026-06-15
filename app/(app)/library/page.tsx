import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { ArrowRight, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/library");

  const readableBooks = await db
    .select({
      id: schema.books.id,
      slug: schema.books.slug,
      titleAr: schema.books.titleAr,
      titleEn: schema.books.titleEn,
      level: schema.books.level,
      blurb: schema.books.blurb,
      chapterCount: count(schema.bookChapters.id),
    })
    .from(schema.books)
    .leftJoin(schema.bookChapters, eq(schema.bookChapters.bookId, schema.books.id))
    .where(eq(schema.books.hasFullText, true))
    .groupBy(schema.books.id)
    .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel));

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-24 pt-6">
      <header className="text-center">
        <p className="font-arabic text-4xl text-brand" dir="rtl">
          المَكْتَبَة
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">The Library</h1>
        <p className="mx-auto mt-1 max-w-lg text-sm text-fg-muted">
          Every book on the path, readable inside the app — tap any word for instant translation,
          save it to flashcards, and take a comprehension check per chapter. No dictionary, no
          friction. Finish a book to move along your path.
        </p>
      </header>

      <section>
        <div className="space-y-3">
          {readableBooks.map((b) => (
            <Link
              key={b.id}
              href={`/book/${b.slug}`}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-border transition hover:ring-brand"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-100 text-brand">
                <BookOpen className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-arabic truncate text-xl font-bold" dir="rtl">
                  {b.titleAr}
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {b.titleEn} · Stage {b.level} · {Number(b.chapterCount)} chapters
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-fg-muted" />
            </Link>
          ))}
          {readableBooks.length === 0 && (
            <p className="rounded-2xl bg-bg-muted p-6 text-center text-sm text-fg-muted">
              No books are loaded yet. They&apos;ll appear here as they&apos;re added to the path.
            </p>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fg-muted">
          Books are added to the path over time. Want a specific title? Let us know and we&apos;ll
          work on getting it in.
        </p>
      </section>
    </main>
  );
}
