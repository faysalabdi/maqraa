import Link from "next/link";
import { ArrowRight, Sparkles, BookOpen, Brain, Flame } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-16 px-6 py-20">
      {/* Hero */}
      <section className="max-w-3xl space-y-5 text-center">
        <p className="font-arabic text-5xl text-brand sm:text-7xl" dir="rtl">
          اِقْرَأْ
        </p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
          Read real Arabic books. <span className="text-brand">Tap any word.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-lg text-fg-muted sm:text-xl">
          Start on short graded readers, tap any word for an instant translation, and grow a
          vocabulary that sticks with spaced repetition. When you&apos;re ready, bring your own
          books.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-4 text-base font-extrabold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
          >
            Start reading <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/preview"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-7 py-4 text-base font-semibold text-fg shadow-soft transition hover:bg-bg-muted"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<Sparkles className="h-6 w-6" />}
          tone="emerald"
          title="Tap to translate"
          body="Tap any Arabic word for its dictionary form and meaning in context, then save it to your deck. Read page by page, no dictionary juggling."
        />
        <FeatureCard
          icon={<BookOpen className="h-6 w-6" />}
          tone="amber"
          title="Bring your own books"
          body="Begin on a curated graded shelf. Once you've finished a couple, upload any EPUB — real chapters and difficulty are detected automatically."
        />
        <FeatureCard
          icon={<Brain className="h-6 w-6" />}
          tone="sky"
          title="Spaced repetition"
          body="Every word you save enters an SM-2 review queue. A few minutes a day turns words you didn't know into words you do."
        />
      </section>

      {/* Streak / addictive hook */}
      <section className="w-full max-w-3xl rounded-3xl bg-gradient-to-br from-orange-100 via-amber-50 to-white p-8 text-center shadow-lift ring-1 ring-orange-200">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-700 ring-1 ring-orange-200">
          <Flame className="h-3.5 w-3.5" /> Streak · words learned · books finished
        </span>
        <h2 className="mt-4 text-3xl font-extrabold">Showing up is the win.</h2>
        <p className="mx-auto mt-2 max-w-xl text-fg-muted">
          One unknown word shouldn&apos;t derail reading. Build a streak, watch your saved words
          climb, and finish real books — progress you can actually see, no fake levels.
        </p>
      </section>

      {/* Book strip */}
      <p className="font-arabic max-w-2xl text-balance text-center text-base text-fg-muted" dir="rtl">
        رحلة سامر · الأربعون النووية · الأربعون القدسية · كليلة ودمنة
      </p>
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
  tone: "emerald" | "amber" | "sky";
  title: string;
  body: string;
}) {
  const bg =
    tone === "emerald"
      ? "from-emerald-50 to-white ring-emerald-200"
      : tone === "amber"
        ? "from-amber-50 to-white ring-amber-200"
        : "from-sky-50 to-white ring-sky-200";
  const iconBg =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-sky-500";
  return (
    <div className={`rounded-2xl bg-gradient-to-br p-6 shadow-soft ring-1 ${bg}`}>
      <span className={`mb-4 inline-grid h-12 w-12 place-items-center rounded-xl text-white shadow-soft ${iconBg}`}>
        {icon}
      </span>
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{body}</p>
    </div>
  );
}
