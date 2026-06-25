import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { booksFinished, isAdmin, uploadUnlocked, UPLOAD_MIN_BOOKS } from "@/lib/admin";
import { BookCover } from "@/components/book/BookCover";
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
  if (!user) redirect("/sign-in?redirect=/upload");

  const admin = isAdmin(user.email);
  const finished = await booksFinished(user.id);

  // Earned gate: uploading your own books unlocks after finishing a couple.
  if (!uploadUnlocked(user.email, finished)) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-24 pt-16 text-center">
        <div className="rounded-3xl bg-surface p-10 shadow-card ring-1 ring-border">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-bg-muted text-fg-muted">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight">
            Uploading unlocks after {UPLOAD_MIN_BOOKS} books
          </h1>
          <p className="mt-2 text-fg-muted">
            Finish {UPLOAD_MIN_BOOKS} books from the starter shelf ({finished}/{UPLOAD_MIN_BOOKS}{" "}
            done), then you can add your own EPUBs to a private shelf only you can read.
          </p>
          <Link
            href="/path"
            className="mt-5 inline-flex rounded-xl bg-brand px-5 py-3 font-bold text-brand-fg transition hover:bg-brand-dark"
          >
            Back to reading
          </Link>
        </div>
      </main>
    );
  }

  const levels = await db
    .select({ level: schema.levels.level, nameEn: schema.levels.nameEn })
    .from(schema.levels)
    .orderBy(asc(schema.levels.level));

  // Admins manage the whole curated catalogue; everyone else manages only their own uploads.
  const bookRows = await db
    .select({
      id: schema.books.id,
      slug: schema.books.slug,
      titleAr: schema.books.titleAr,
      titleEn: schema.books.titleEn,
      level: schema.books.level,
      genre: schema.books.genre,
      authorAr: schema.books.authorAr,
      authorEn: schema.books.authorEn,
      ownerId: schema.books.ownerId,
      hasFullText: schema.books.hasFullText,
      chapterCount: count(schema.bookChapters.id),
    })
    .from(schema.books)
    .leftJoin(schema.bookChapters, eq(schema.bookChapters.bookId, schema.books.id))
    .groupBy(schema.books.id)
    .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel));

  const myBooks = admin ? bookRows : bookRows.filter((b) => b.ownerId === user.id);

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 pb-24 pt-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Add a book</h1>
        <p className="mt-1 text-fg-muted">
          Drop an EPUB — it&apos;s parsed in your browser, then AI fills the difficulty, genre, blurb
          and chapters. The whole book never leaves your device.{" "}
          {admin ? "Books you add join the public catalogue." : "Your uploads are private to you."}
        </p>
      </header>

      <AddBook levels={levels} />

      {myBooks.length > 0 &&
        (admin ? (
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Books in the catalogue</h2>
            <ChaptersList bookIds={myBooks.map((b) => b.id)} levels={levels} adminBooks={myBooks} />
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Your uploads</h2>
            <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
              {myBooks.map((b) => (
                <Link key={b.id} href={`/book/${b.slug}`} className="group">
                  <BookCover
                    titleAr={b.titleAr}
                    authorAr={b.authorAr}
                    authorEn={b.authorEn}
                    genre={b.genre}
                    size="md"
                    className="w-full transition group-hover:-translate-y-1 group-hover:shadow-lift"
                  />
                  <p className="mt-2 line-clamp-2 text-center text-xs font-semibold">{b.titleEn}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}

async function ChaptersList({
  bookIds,
  levels,
  adminBooks,
}: {
  bookIds: string[];
  levels: LevelOption[];
  adminBooks: {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    level: number;
    genre: string;
    hasFullText: boolean;
    chapterCount: number;
  }[];
}) {
  const chapters = bookIds.length
    ? await db
        .select({
          id: schema.bookChapters.id,
          bookId: schema.bookChapters.bookId,
          chapterNumber: schema.bookChapters.chapterNumber,
          titleAr: schema.bookChapters.titleAr,
          titleEn: schema.bookChapters.titleEn,
        })
        .from(schema.bookChapters)
    : [];
  return (
    <BookAdmin
      books={adminBooks as AdminBook[]}
      chapters={chapters as AdminChapter[]}
      levels={levels}
    />
  );
}
