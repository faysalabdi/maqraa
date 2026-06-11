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
          Read Arabic. Level up. <span className="text-brand">Finish books.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-lg text-fg-muted sm:text-xl">
          A gamified path from children&apos;s stories to Ibn al-Qayyim. Real
          comprehension tests, XP, streaks, and a vocab review queue that turns the
          words you didn&apos;t know into the words you do.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-4 text-base font-extrabold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
          >
            Start your path <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/preview"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-7 py-4 text-base font-semibold text-fg shadow-soft transition hover:bg-bg-muted"
          >
            See the path
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<Sparkles className="h-6 w-6" />}
          tone="emerald"
          title="Whole-book tests"
          body="Finish a book, take a 12-question comprehension test generated from Claude's knowledge of it. No upload, no excerpts."
        />
        <FeatureCard
          icon={<BookOpen className="h-6 w-6" />}
          tone="amber"
          title="Eight stages"
          body="Children's stories to classical scholarship. 50+ books across Islamic, literary, translated, and graded readers."
        />
        <FeatureCard
          icon={<Brain className="h-6 w-6" />}
          tone="sky"
          title="Spaced repetition"
          body="Words you miss on a test get added to an SM-2 review queue. Daily reviews, no flashcard tedium."
        />
      </section>

      {/* Streak / addictive hook */}
      <section className="w-full max-w-3xl rounded-3xl bg-gradient-to-br from-orange-100 via-amber-50 to-white p-8 text-center shadow-lift ring-1 ring-orange-200">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-700 ring-1 ring-orange-200">
          <Flame className="h-3.5 w-3.5" /> Streaks · daily goal · XP
        </span>
        <h2 className="mt-4 text-3xl font-extrabold">
          Consistency is the reward.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-fg-muted">
          One unknown word should not derail reading. This app makes showing up the
          win — XP for tests, vocab graduations, daily streaks, and 12 achievements
          for the long game.
        </p>
      </section>

      {/* Book strip */}
      <p className="max-w-2xl text-balance text-center text-sm text-fg-muted">
        قصص النبيين · Animal Farm · Harry Potter · رياض الصالحين · ثلاثية القاهرة
        · مدارج السالكين · The Little Prince · Brothers Karamazov
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
