import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { strengthFor, STRENGTH_META, STRENGTH_ORDER, type Strength } from "@/lib/srs/strength";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WordsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const words = await db
    .select()
    .from(schema.vocabItems)
    .where(eq(schema.vocabItems.userId, user.id))
    .orderBy(desc(schema.vocabItems.createdAt));

  const groups = new Map<Strength, typeof words>();
  for (const s of STRENGTH_ORDER) groups.set(s, []);
  for (const w of words) {
    groups.get(strengthFor({ ...w, ease: Number(w.ease) }))!.push(w);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold">My words</h1>
        <p className="mt-1 text-fg-muted">
          {words.length} {words.length === 1 ? "word" : "words"} collected. Every word you tap
          while reading lives here, grouped by how well you know it.
        </p>
        <Link
          href="/review"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
        >
          <Flame className="h-4 w-4" /> Practice now
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-5 gap-2 text-center">
        {STRENGTH_ORDER.map((s) => (
          <div key={s} className={cn("rounded-2xl p-3 ring-1", STRENGTH_META[s].color)}>
            <p className="text-2xl font-extrabold">{groups.get(s)!.length}</p>
            <p className="text-xs font-semibold">{STRENGTH_META[s].labelEn}</p>
          </div>
        ))}
      </div>

      {words.length === 0 && (
        <p className="text-center text-fg-muted">
          No words yet. Open a readable book on{" "}
          <Link href="/path" className="font-semibold text-brand underline">
            your path
          </Link>{" "}
          and tap any word to save it.
        </p>
      )}

      <div className="space-y-8">
        {STRENGTH_ORDER.map((s) => {
          const items = groups.get(s)!;
          if (items.length === 0) return null;
          return (
            <section key={s}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <span
                  className={cn(
                    "rounded-full px-3 py-0.5 text-xs font-semibold ring-1",
                    STRENGTH_META[s].color,
                  )}
                >
                  {STRENGTH_META[s].labelEn}
                </span>
                <span className="font-arabic text-base text-fg-muted">
                  {STRENGTH_META[s].labelAr}
                </span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((w) => (
                  <div
                    key={w.id}
                    title={w.glossEn}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border"
                  >
                    <p className="font-arabic text-2xl font-bold" dir="rtl">
                      {w.lemmaAr}
                    </p>
                    <div className="shrink-0 text-right text-xs text-fg-muted">
                      <p>{w.repetitions} reviews</p>
                      {w.intervalDays > 0 && <p>every {w.intervalDays}d</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
