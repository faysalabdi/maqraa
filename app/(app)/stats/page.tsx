import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { strengthFor, STRENGTH_META, STRENGTH_ORDER, type Strength } from "@/lib/srs/strength";
import { rankForXp } from "@/lib/xp/curve";
import { cn } from "@/lib/utils";
import { Flame, Star, BookOpen, Brain } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);
  const [streak] = await db
    .select()
    .from(schema.streaks)
    .where(eq(schema.streaks.userId, user.id))
    .limit(1);
  const words = await db
    .select()
    .from(schema.vocabItems)
    .where(eq(schema.vocabItems.userId, user.id));
  const chaptersDone = await db
    .select()
    .from(schema.userChapterProgress)
    .where(eq(schema.userChapterProgress.userId, user.id));
  const recentXp = await db
    .select()
    .from(schema.xpEvents)
    .where(eq(schema.xpEvents.userId, user.id))
    .orderBy(desc(schema.xpEvents.occurredAt))
    .limit(10);

  const xpTotal = profile?.xpTotal ?? 0;
  const rank = rankForXp(xpTotal);
  const completedChapters = chaptersDone.filter((c) => c.status === "completed").length;

  const strengthCounts = new Map<Strength, number>();
  for (const s of STRENGTH_ORDER) strengthCounts.set(s, 0);
  for (const w of words) {
    const s = strengthFor({ ...w, ease: Number(w.ease) });
    strengthCounts.set(s, (strengthCounts.get(s) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
      <h1 className="mb-8 text-center text-3xl font-extrabold">Your stats</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Total XP"
          value={xpTotal.toLocaleString()}
          tint="bg-amber-100 text-amber-800"
        />
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="Streak"
          value={`${streak?.currentDays ?? 0}d`}
          tint="bg-orange-100 text-orange-800"
        />
        <StatCard
          icon={<Brain className="h-5 w-5" />}
          label="Words"
          value={String(words.length)}
          tint="bg-sky-100 text-sky-800"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Chapters"
          value={String(completedChapters)}
          tint="bg-emerald-100 text-emerald-800"
        />
      </div>

      <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Rank {rank.rank}</h2>
          <span className="text-sm text-fg-muted">
            {rank.xpInRank} / {rank.xpToNext} XP to rank {rank.rank + 1}
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400"
            style={{ width: `${Math.min(100, (rank.xpInRank / rank.xpToNext) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
        <h2 className="mb-4 text-lg font-bold">Vocabulary strength</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          {STRENGTH_ORDER.map((s) => (
            <div key={s} className={cn("rounded-2xl p-3 ring-1", STRENGTH_META[s].color)}>
              <p className="text-2xl font-extrabold">{strengthCounts.get(s)}</p>
              <p className="text-[11px] font-semibold">{STRENGTH_META[s].labelEn}</p>
            </div>
          ))}
        </div>
        <Link
          href="/words"
          className="mt-4 block text-center text-sm font-semibold text-brand hover:underline"
        >
          See all words →
        </Link>
      </div>

      {recentXp.length > 0 && (
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
          <h2 className="mb-3 text-lg font-bold">Recent XP</h2>
          <ul className="space-y-2 text-sm">
            {recentXp.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span className="text-fg-muted">{e.reason.replaceAll("_", " ")}</span>
                <span className="font-bold text-brand">+{e.delta}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-border">
      <span className={cn("mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full", tint)}>
        {icon}
      </span>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold text-fg-muted">{label}</p>
    </div>
  );
}
