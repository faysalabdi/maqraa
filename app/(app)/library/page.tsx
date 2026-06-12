import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { ArrowRight, BookOpen, FileText, Wand2 } from "lucide-react";

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

  const [textCount] = await db
    .select({ n: count() })
    .from(schema.userTexts)
    .where(eq(schema.userTexts.userId, user.id));

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-24 pt-6">
      <header className="text-center">
        <p className="font-arabic text-4xl text-brand" dir="rtl">
          المَكْتَبَة
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">The Library</h1>
        <p className="mx-auto mt-1 max-w-lg text-sm text-fg-muted">
          Everything readable inside the app — tap any word for instant translation, save it to
          flashcards, and take a comprehension check per section. No dictionary, no friction.
        </p>
      </header>

      {/* The two big actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/texts"
          className="group rounded-3xl bg-gradient-to-br from-violet-50 to-white p-5 shadow-soft ring-1 ring-violet-200 transition hover:shadow-lift"
        >
          <span className="mb-3 inline-grid h-11 w-11 place-items-center rounded-xl bg-violet-500 text-white">
            <Wand2 className="h-5 w-5" />
          </span>
          <h2 className="font-extrabold">Generate a story</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            Fresh, original, exactly at your level. Endless material at the tap of a button.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-violet-600">
            Story Forge <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/texts"
          className="group rounded-3xl bg-gradient-to-br from-amber-50 to-white p-5 shadow-soft ring-1 ring-amber-200 transition hover:shadow-lift"
        >
          <span className="mb-3 inline-grid h-11 w-11 place-items-center rounded-xl bg-amber-500 text-white">
            <FileText className="h-5 w-5" />
          </span>
          <h2 className="font-extrabold">Bring your own book</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            Import a PDF of a book you own. Claude reads each page directly so Arabic comes
            out in the right order. Position saved, vocab saved, quizzes per section.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-amber-600">
            My reading {textCount && Number(textCount.n) > 0 ? `(${textCount.n})` : ""}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>

      {/* Built-in readable books */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Built-in books</h2>
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
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fg-muted">
          Built-in books are public domain or written for Arabic XP — we can only embed full
          text we have the right to host. For any other book on your path, import your own copy
          (PDF) above and read it here with all the same tools.
        </p>
      </section>
    </main>
  );
}
