import Link from "next/link";
import { Headphones, MessagesSquare, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PracticePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <header className="mb-8 text-center">
        <p className="font-arabic text-4xl text-brand" dir="rtl">
          تَدَرَّبْ
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">Practice</h1>
        <p className="mt-1 text-fg-muted">
          Reading builds your base. These build your ears and your tongue.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/practice/conversation"
          className="group rounded-3xl bg-gradient-to-br from-emerald-50 to-white p-6 shadow-soft ring-1 ring-emerald-200 transition hover:shadow-lift"
        >
          <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-emerald-500 text-white shadow-soft">
            <MessagesSquare className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-extrabold">Conversation</h2>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            Role-play everyday scenarios — the market, the bookshop, meeting someone new — with
            an AI partner who replies at your level, corrects gently, and never gets tired. Tap
            any word it says to translate and save it.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand">
            Start talking <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/practice/listening"
          className="group rounded-3xl bg-gradient-to-br from-sky-50 to-white p-6 shadow-soft ring-1 ring-sky-200 transition hover:shadow-lift"
        >
          <span className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-sky-500 text-white shadow-soft">
            <Headphones className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-extrabold">Listening</h2>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            Hear a short Arabic passage read aloud — no text shown — then answer comprehension
            questions from your ears alone. Passages are generated fresh at your level.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-sky-600">
            Start listening{" "}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-fg-muted">
        Speaking practice (microphone + pronunciation feedback) is coming next.
      </p>
    </main>
  );
}
