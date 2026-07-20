import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { getPlan } from "@/lib/entitlement";
import { ProBlock } from "@/components/paywall/ProBlock";
import { BookCover } from "@/components/book/BookCover";
import { AddBook } from "@/components/upload/AddBook";
import { BookAdmin, type AdminBook, type AdminChapter } from "@/components/admin/BookAdmin";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/upload");

  const admin = isAdmin(user.email);
  const plan = await getPlan(user.id, user.email);

  // Bringing your own books is a Pro feature.
  if (plan !== "pro" && !admin) {
    return (
      <ProBlock
        title="Bring your own books with Pro"
        body="Upload any EPUB and read it right here — tap-to-translate, flashcards and all — on a private shelf only you can see."
        bullets={[
          "Upload unlimited EPUBs",
          "Auto chapters & difficulty",
          "Higher daily translation limits",
          "Every curated book, every level",
        ]}
      />
    );
  }

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
      blurb: schema.books.blurb,
      difficulty: schema.books.difficulty,
      recommendedPages: schema.books.recommendedPages,
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
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Your library</h1>
        <p className="mt-1 text-fg-muted">
          Drop an EPUB — it&apos;s parsed in your browser, then AI fills the difficulty, genre, blurb
          and chapters. The whole book never leaves your device.{" "}
          {admin ? "Books you add join the public catalogue." : "Your uploads are private to you."}
        </p>
      </header>

      <AddBook isAdmin={admin} />

      {myBooks.length > 0 &&
        (admin ? (
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Books in the catalogue</h2>
            <ChaptersList bookIds={myBooks.map((b) => b.id)} adminBooks={myBooks} />
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
  adminBooks,
}: {
  bookIds: string[];
  adminBooks: AdminBook[];
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
  return <BookAdmin books={adminBooks as AdminBook[]} chapters={chapters as AdminChapter[]} />;
}
