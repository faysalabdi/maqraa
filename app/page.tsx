import Link from "next/link";
import { ArrowRight, BookmarkPlus, Sparkles, Brain, FileUp, Wand2 } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { BookCover } from "@/components/book/BookCover";

const SHELF = [
  { titleAr: "رحلة سامر", genre: "graded_reader", authorAr: null, band: "Beginner" },
  { titleAr: "نوادر جحا", genre: "arabic_literature", authorAr: null, band: "Beginner" },
  { titleAr: "ألف ليلة وليلة", genre: "classical", authorAr: null, band: "Intermediate" },
  { titleAr: "كليلة ودمنة", genre: "classical", authorAr: "ابن المقفع", band: "Advanced" },
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
        <LogoMark className="h-16" />
        <h1 className="font-serif text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          Finish your first Arabic book.
        </h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-fg-muted">
          Tap any word for an instant meaning in context, save it to a smart review deck, and keep
          reading. No level ladder — just books finished and words mastered.
        </p>
        <div className="mt-1 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in?new=1"
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


      {/* Bring-your-own spotlight */}
      <section className="animate-rise w-full max-w-4xl overflow-hidden rounded-[2rem] bg-surface text-left shadow-card ring-1 ring-border">
        <div className="grid items-center gap-8 p-8 sm:p-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-fg">
              <FileUp className="h-3.5 w-3.5" /> Bring your own books
            </span>
            <h2 className="font-serif mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              Read the books you
              <br className="hidden sm:block" /> already love.
            </h2>
            <p className="mt-3 text-fg-muted">
              The curated shelf is just the on-ramp. Maqraa is built to read <em>your</em> library —
              any EPUB becomes a tappable, translatable, reviewable book in seconds.
            </p>
            <ul className="mt-6 space-y-3">
              <SpotlightPoint
                icon={<FileUp className="h-4 w-4" />}
                title="Upload any EPUB"
                body="Drop a file — it stays private to your account."
              />
              <SpotlightPoint
                icon={<Wand2 className="h-4 w-4" />}
                title="Auto chapters & difficulty"
                body="We split it into chapters and grade the level for you."
              />
              <SpotlightPoint
                icon={<BookmarkPlus className="h-4 w-4" />}
                title="Tap-to-translate everywhere"
                body="The same word lookups and SRS work on your own books."
              />
            </ul>
            <Link
              href="/sign-in?new=1"
              className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-base font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
            >
              Start your library <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
      {/* Features */}
      <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<Sparkles className="h-6 w-6" />}
          tone="brand"
          title="Tap to translate"
          body="Lemma + meaning in context, then save it to your deck. Read page by page, no dictionary juggling."
        />
        <FeatureCard
          icon={<Brain className="h-6 w-6" />}
          tone="iris"
          title="Spaced repetition"
          body="Every saved word enters an SM-2 queue. A few minutes a day turns words you didn't know into words you do."
        />
        <FeatureCard
          icon={<FileUp className="h-6 w-6" />}
          tone="accent"
          title="Your books, not ours"
          body="A curated shelf gets you started — then read whatever you already own. Upload any EPUB and it's yours."
        />
      </section>
          {/* Library mock */}
          <div className="relative rounded-3xl bg-gradient-to-br from-bg-muted to-surface p-6 ring-1 ring-border">
            <div className="flex items-end justify-center gap-3">
              <BookCover titleAr="رحلة سامر" genre="graded_reader" band="Beginner" size="md" className="w-20 -rotate-6" />
              <BookCover titleAr="ألف ليلة وليلة" genre="classical" band="Intermediate" size="md" className="z-10 w-24" />
              <BookCover titleAr="كليلة ودمنة" authorAr="ابن المقفع" genre="classical" band="Advanced" size="md" className="w-20 rotate-6" />
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-surface/70 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <FileUp className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">Drop your EPUB here</p>
                <p className="text-xs text-fg-muted">your-book.epub → ready to read</p>
              </div>
              <span className="ml-auto rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-fg">Add</span>
            </div>
          </div>
        </div>
      </section>

      {/* Curated shelf */}
      <section className="w-full max-w-3xl">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-fg-muted">
          Start your shelf
        </p>
        <p className="mb-5 text-sm text-fg-muted">
          Famous public-domain reads, grouped by level — before you bring your own.
        </p>
        <div className="flex justify-center gap-4 overflow-x-auto pb-2">
          {SHELF.map((b) => (
            <div key={b.titleAr} className="flex shrink-0 flex-col items-center gap-2">
              <BookCover
                titleAr={b.titleAr}
                authorAr={b.authorAr}
                genre={b.genre}
                band={b.band}
                showBand={false}
                size="md"
                className="w-24 sm:w-28"
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{b.band}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-16 w-full max-w-3xl border-t border-border pt-6 text-center text-xs text-fg-muted">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span>© {new Date().getFullYear()} Maqraa</span>
          <Link href="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-fg">
            Terms
          </Link>
        </div>
      </footer>
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
    <div className="rounded-3xl bg-surface p-6 text-left shadow-card ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-lift">
      <span className={`mb-4 inline-grid h-12 w-12 place-items-center rounded-2xl shadow-soft ${iconBg}`}>
        {icon}
      </span>
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{body}</p>
    </div>
  );
}

function SpotlightPoint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
        {icon}
      </span>
      <span className="text-sm">
        <span className="font-bold">{title}</span>
        <span className="block text-fg-muted">{body}</span>
      </span>
    </li>
  );
}
