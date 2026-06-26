import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getBookBySlug, getUserBook } from "@/lib/db/queries/path";
import { fetchOrGenerateTest } from "@/lib/test/fetch-or-generate";
import { consumeAiQuota } from "@/lib/ai/quota";
import { getPlan, canReadTier } from "@/lib/entitlement";
import TestRunner from "@/components/book/TestRunner";
import { AlertTriangle, ArrowLeft } from "lucide-react";

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

  // Private uploads are testable only by their owner.
  if (book.ownerId && book.ownerId !== user.id) notFound();
  // The whole-book test is generated from Claude's knowledge of known books, so it
  // isn't meaningful for a reader's own upload — chapter quizzes cover those.
  if (book.ownerId) redirect(`/book/${slug}`);
  // Curated books above the free tier require Pro.
  const plan = await getPlan(user.id, user.email);
  if (!canReadTier(plan, book.level)) redirect("/upgrade");

  const userBook = await getUserBook(user.id, book.id);

  // The comprehension test is optional and always available for a readable book.
  // Mark it "testing" while in progress, but never downgrade a completed book.
  if (!userBook) {
    await db
      .insert(schema.userBooks)
      .values({ userId: user.id, bookId: book.id, status: "testing", startedAt: new Date() })
      .onConflictDoNothing();
  } else if (userBook.status !== "completed") {
    await db
      .update(schema.userBooks)
      .set({ status: "testing", updatedAt: new Date() })
      .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, book.id)));
  }

  // Only meter an actual generation, not a cached re-open.
  const [existingTest] = await db
    .select({ id: schema.comprehensionTests.id })
    .from(schema.comprehensionTests)
    .where(eq(schema.comprehensionTests.bookId, book.id))
    .limit(1);
  if (!existingTest) await consumeAiQuota(user.id, "test", user.email);
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
