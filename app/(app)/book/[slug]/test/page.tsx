import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getBookBySlug, getUserBook } from "@/lib/db/queries/path";
import { fetchOrGenerateTest } from "@/lib/test/fetch-or-generate";
import TestRunner from "@/components/book/TestRunner";
import { AlertTriangle, ArrowLeft, BookOpen } from "lucide-react";

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

  // Show explicit error UI instead of silent redirect
  if (
    !userBook ||
    !["reading_done", "testing", "failed_retry"].includes(userBook.status)
  ) {
    return (
      <ErrorScreen
        slug={slug}
        title="Mark the book finished first"
        body="The test only unlocks after you mark this book as finished on the book page."
        icon={<BookOpen className="h-7 w-7" />}
        actionLabel="Back to book"
        actionHref={`/book/${slug}`}
      />
    );
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
    return (
      <ErrorScreen
        slug={slug}
        title="Could not generate the test"
        body={result.error}
        icon={<AlertTriangle className="h-7 w-7" />}
        actionLabel="Try again"
        actionHref={`/book/${slug}/test`}
      />
    );
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

function ErrorScreen({
  slug,
  title,
  body,
  icon,
  actionLabel,
  actionHref,
}: {
  slug: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <main className="mx-auto max-w-md px-4 pt-12 text-center">
      <Link
        href={`/book/${slug}`}
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-fg-muted transition hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back to book
      </Link>
      <div className="rounded-3xl bg-white p-10 shadow-lift ring-1 ring-border">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          {icon}
        </span>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{body}</p>
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
        >
          {actionLabel}
        </Link>
      </div>
    </main>
  );
}
