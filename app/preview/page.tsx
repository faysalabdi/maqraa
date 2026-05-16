import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { db, schema } from "@/lib/db";
import { asc } from "drizzle-orm";
import { StagePreviewCard, type StagePreviewData } from "@/components/path/StagePreviewCard";

export const revalidate = 3600; // catalogue rarely changes — cache 1h

export default async function PreviewPage() {
  const [levels, books] = await Promise.all([
    db.select().from(schema.levels).orderBy(asc(schema.levels.level)),
    db
      .select()
      .from(schema.books)
      .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel)),
  ]);

  const stages: StagePreviewData[] = levels.map((lv) => ({
    level: lv.level,
    nameEn: lv.nameEn,
    nameAr: lv.nameAr,
    description: lv.description,
    books: books
      .filter((b) => b.level === lv.level)
      .map((b) => ({
        id: b.id,
        titleAr: b.titleAr,
        titleEn: b.titleEn,
        authorEn: b.authorEn,
      })),
  }));

  const totalBooks = books.length;

  return (
    <>
      {/* Sticky CTA bar */}
      <div className="sticky top-0 z-20 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-sm transition hover:bg-brand-dark"
          >
            Start your path <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10">
        {/* Hero */}
        <section className="mb-10 text-center">
          <p className="font-arabic text-3xl text-brand sm:text-4xl" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Preview the journey
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-base text-fg-muted">
            {levels.length} stages · {totalBooks}+ books · from fully diacritized
            children&apos;s stories to classical scholarship.
          </p>
        </section>

        {/* Stage cards */}
        <section className="space-y-4">
          {stages.map((stage) => (
            <StagePreviewCard key={stage.level} stage={stage} />
          ))}
        </section>

        {/* Bottom CTA */}
        <section className="mt-12 rounded-3xl bg-gradient-to-br from-brand/10 to-accent/10 p-8 text-center ring-1 ring-border">
          <Sparkles className="mx-auto h-8 w-8 text-brand" />
          <h2 className="mt-3 text-2xl font-extrabold">Ready to begin?</h2>
          <p className="mx-auto mt-2 max-w-md text-base text-fg-muted">
            Sign in to unlock Stage 1, log your reading, and earn XP. No password —
            we&apos;ll email you a code.
          </p>
          <Link
            href="/sign-in"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-brand-fg shadow-sm transition hover:bg-brand-dark"
          >
            Start your path <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </>
  );
}
