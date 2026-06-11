import Link from "next/link";
import { BookOpen, Languages, Flame, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-12 px-6 py-16 text-center">
      <div className="space-y-5">
        <p className="font-arabic text-6xl text-brand sm:text-7xl" dir="rtl">
          اِقْرَأْ
        </p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
          Read Arabic. Level up. Finish books.
        </h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-fg-muted">
          Read books right here with tap-to-translate, collect every word you learn, train
          them with flashcards, and climb a path from children&apos;s stories to Ibn
          al-Qayyim — with real comprehension checks at every step.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        <Feature icon={<BookOpen className="h-5 w-5" />} title="Read in-app">
          Chapters with full tashkeel
        </Feature>
        <Feature icon={<Languages className="h-5 w-5" />} title="Tap to translate">
          Zero-friction lookups
        </Feature>
        <Feature icon={<Flame className="h-5 w-5" />} title="Flashcards">
          Words grouped by strength
        </Feature>
        <Feature icon={<Sparkles className="h-5 w-5" />} title="Comprehension">
          Quizzes after every chapter
        </Feature>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/sign-in"
          className="rounded-2xl bg-brand px-8 py-4 text-lg font-bold text-brand-fg shadow-lg shadow-emerald-200 transition hover:scale-105 hover:bg-brand-dark"
        >
          Start your path
        </Link>
        <Link
          href="/path"
          className="rounded-2xl border border-border px-8 py-4 text-lg font-semibold text-fg transition hover:bg-bg-muted"
        >
          See the path
        </Link>
      </div>

      <p className="text-sm text-fg-muted">
        قصص النبيين · الأربعون النووية · Animal Farm · Harry Potter · ثلاثية القاهرة · مدارج
        السالكين
      </p>
    </main>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-border">
      <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-brand">
        {icon}
      </span>
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-fg-muted">{children}</p>
    </div>
  );
}
