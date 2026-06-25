import Link from "next/link";
import { ArrowRight, BookmarkPlus, Sparkles, BookOpen, Brain } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { BookCover } from "@/components/book/BookCover";

const SHELF = [
  { titleAr: "رحلة سامر", genre: "graded_reader", authorAr: null, band: "A1" },
  { titleAr: "الأربعون النووية", genre: "islamic", authorAr: "النووي", band: "B1" },
  { titleAr: "كليلة ودمنة", genre: "classical", authorAr: "ابن المقفع", band: "B2" },
  { titleAr: "الأربعون القدسية", genre: "islamic", authorAr: "النووي", band: "B1" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center gap-20 px-6 py-16 text-center sm:py-24">
      {/* Hero */}
      <section className="animate-rise flex max-w-2xl flex-col items-center gap-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-fg-muted shadow-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Read real Arabic books — not flashcards
        </span>
        <LogoMark className="h-16 w-16" />
        <h1 className="font-serif text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          Finish your first Arabic book.
        </h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-fg-muted">
          Tap any word for an instant meaning in context, save it to a smart review deck, and keep
          reading. No level ladder — just books finished and words mastered.
        </p>
        <div className="mt-1 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-3.5 text-base font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
          >
            Start reading — free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/preview"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-7 py-3.5 text-base font-semibold text-fg shadow-soft transition hover:shadow-lift"
          >
            See tap-to-translate <ArrowRight className="h-4 w-4 -rotate-45" />
          </Link>
        </div>
      </section>

      {/* Tap-to-translate demo */}
      <section className="animate-rise w-full max-w-md">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-fg-muted">
          Tap any word
        </p>
        <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
          <p className="font-arabic text-2xl leading-loose" dir="rtl">
            هَذَا الدَّوَاءُ{" "}
            <span className="rounded bg-accent-soft px-1 underline decoration-dotted decoration-accent underline-offset-[6px]">
              يَنْفَعُ
            </span>{" "}
            الْمَرِيضَ.
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-bg-muted p-3 text-left">
            <span className="font-arabic text-2xl font-bold" dir="rtl">
              نَفَعَ
            </span>
            <span className="text-sm">
              <span className="font-semibold">to benefit</span>
              <span className="block text-xs text-fg-muted">verb · tap to save</span>
            </span>
            <span className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-fg">
              <BookmarkPlus className="h-4 w-4" />
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<Sparkles className="h-6 w-6" />}
          tone="brand"
          title="Tap to translate"
          body="Lemma + meaning in context, then save it to your deck. Read page by page, no dictionary juggling."
        />
        <FeatureCard
          icon={<BookOpen className="h-6 w-6" />}
          tone="accent"
          title="Bring your own books"
          body="Begin on a curated graded shelf, then upload any EPUB — chapters and difficulty detected automatically."
        />
        <FeatureCard
          icon={<Brain className="h-6 w-6" />}
          tone="iris"
          title="Spaced repetition"
          body="Every saved word enters an SM-2 queue. A few minutes a day turns words you didn't know into words you do."
        />
      </section>

      {/* Curated shelf */}
      <section className="w-full max-w-3xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-fg-muted">
          Start your shelf
        </p>
        <div className="flex justify-center gap-4 overflow-x-auto pb-2">
          {SHELF.map((b) => (
            <BookCover
              key={b.titleAr}
              titleAr={b.titleAr}
              authorAr={b.authorAr}
              genre={b.genre}
              band={b.band}
              size="md"
              className="w-24 shrink-0 sm:w-28"
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: "brand" | "accent" | "iris";
  title: string;
  body: string;
}) {
  const iconBg =
    tone === "brand" ? "bg-brand text-brand-fg" : tone === "accent" ? "bg-accent text-accent-fg" : "bg-iris text-iris-fg";
  return (
    <div className="rounded-3xl bg-surface p-6 text-left shadow-card ring-1 ring-border transition hover:shadow-lift">
      <span className={`mb-4 inline-grid h-12 w-12 place-items-center rounded-2xl shadow-soft ${iconBg}`}>
        {icon}
      </span>
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{body}</p>
    </div>
  );
}
