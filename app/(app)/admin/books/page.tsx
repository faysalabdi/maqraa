import { notFound } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import {
  BookAdmin,
  type AdminBook,
  type AdminChapter,
  type LevelOption,
} from "@/components/admin/BookAdmin";

export const dynamic = "force-dynamic";

export default async function AdminBooksPage() {
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
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-6">
      <header>
        <h1 className="text-3xl font-extrabold">Books</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Add books to the path and paste their chapter text. A book becomes readable in-app the
          moment it has at least one chapter.
        </p>
      </header>
      <BookAdmin
        books={books as AdminBook[]}
        chapters={chapters as AdminChapter[]}
        levels={levels as LevelOption[]}
      />
    </main>
  );
}
