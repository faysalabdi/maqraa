import { notFound } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { AddBook } from "@/components/upload/AddBook";
import {
  BookAdmin,
  type AdminBook,
  type AdminChapter,
  type LevelOption,
} from "@/components/admin/BookAdmin";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) notFound();

  const [books, chapters, levels] = await Promise.all([
    db
      .select({
        id: schema.books.id,
        slug: schema.books.slug,
        titleAr: schema.books.titleAr,
        titleEn: schema.books.titleEn,
        level: schema.books.level,
        genre: schema.books.genre,
        hasFullText: schema.books.hasFullText,
        chapterCount: count(schema.bookChapters.id),
      })
      .from(schema.books)
      .leftJoin(schema.bookChapters, eq(schema.bookChapters.bookId, schema.books.id))
      .groupBy(schema.books.id)
      .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel)),
    db
      .select({
        id: schema.bookChapters.id,
        bookId: schema.bookChapters.bookId,
        chapterNumber: schema.bookChapters.chapterNumber,
        titleAr: schema.bookChapters.titleAr,
        titleEn: schema.bookChapters.titleEn,
      })
      .from(schema.bookChapters),
    db
      .select({ level: schema.levels.level, nameEn: schema.levels.nameEn })
      .from(schema.levels)
      .orderBy(asc(schema.levels.level)),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 pb-24 pt-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Your library</h1>
        <p className="mt-1 text-fg-muted">
          Drop an EPUB to add a readable book — title, author and chapters are pulled in
          automatically. Everything you add appears on the reading path.
        </p>
      </header>

      <AddBook levels={levels} />

      {books.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Books in your library</h2>
          <BookAdmin
            books={books as AdminBook[]}
            chapters={chapters as AdminChapter[]}
            levels={levels as LevelOption[]}
          />
        </section>
      )}
    </main>
  );
}
