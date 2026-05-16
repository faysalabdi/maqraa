import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="space-y-4">
        <p className="font-arabic text-5xl text-brand sm:text-6xl" dir="rtl">
          اِقْرَأْ
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Read Arabic. Level up. Finish books.
        </h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-fg-muted">
          A gamified path from children&apos;s stories to Ibn al-Qayyim. Real
          comprehension tests, XP, streaks, and a vocabulary review queue that
          turns the words you didn&apos;t know into the words you do.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/sign-in"
          className="rounded-2xl bg-brand px-6 py-3 font-semibold text-brand-fg shadow-sm transition hover:bg-brand-dark"
        >
          Start your path
        </Link>
        <Link
          href="/preview"
          className="rounded-2xl border border-border px-6 py-3 font-semibold text-fg transition hover:bg-bg-muted"
        >
          See the path
        </Link>
      </div>
      <p className="text-sm text-fg-muted">
        قصص النبيين · Animal Farm · Harry Potter · رياض الصالحين · ثلاثية القاهرة
        · مدارج السالكين
      </p>
    </main>
  );
}
