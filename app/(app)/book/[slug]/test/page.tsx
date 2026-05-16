import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getBookBySlug, getUserBook } from "@/lib/db/queries/path";
import { fetchOrGenerateTest } from "@/lib/test/fetch-or-generate";
import TestRunner from "@/components/book/TestRunner";

export const dynamic = "force-dynamic";

export default async function TestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const userBook = await getUserBook(user.id, book.id);
  if (
    !userBook ||
    !["reading_done", "testing", "failed_retry"].includes(userBook.status)
  ) {
    redirect(`/book/${slug}`);
  }

  // Transition to "testing" if first time
  if (userBook.status === "reading_done") {
    await db
      .update(schema.userBooks)
      .set({ status: "testing", updatedAt: new Date() })
      .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, book.id)));
  }

  const result = await fetchOrGenerateTest(book.id, user.id);

  if ("error" in result) {
    console.error("[test/page] fetchOrGenerateTest error:", result.error);
    redirect(`/book/${slug}`);
  }

  return (
    <TestRunner
      bookId={book.id}
      bookSlug={book.slug}
      bookTitleAr={book.titleAr}
      bookTitleEn={book.titleEn}
      testId={result.testId}
      questions={result.questions}
      isFallback={result.isFallback}
      passageAr={result.passageAr}
    />
  );
}
