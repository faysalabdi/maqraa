import { Flame, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_GRADIENT: Record<number, string> = {
  1: "from-emerald-200 via-emerald-100 to-white",
  2: "from-sky-200 via-sky-100 to-white",
  3: "from-violet-200 via-violet-100 to-white",
  4: "from-amber-200 via-amber-100 to-white",
  5: "from-orange-200 via-orange-100 to-white",
  6: "from-rose-200 via-rose-100 to-white",
  7: "from-fuchsia-200 via-fuchsia-100 to-white",
  8: "from-yellow-200 via-amber-100 to-white",
};

export function ProgressHero({
  currentLevel,
  levelNameEn,
  levelNameAr,
  booksInLevel,
  booksRequired,
  xpToday,
  dailyGoal,
  streakDays,
  longestStreak,
}: {
  currentLevel: number;
  levelNameEn: string;
  levelNameAr: string;
  booksInLevel: number;
  booksRequired: number;
  xpToday: number;
  dailyGoal: number;
  streakDays: number;
  longestStreak: number;
}) {
  const levelProgress = Math.min(100, Math.round((booksInLevel / booksRequired) * 100));
  const goalProgress = Math.min(100, Math.round((xpToday / Math.max(1, dailyGoal)) * 100));

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 shadow-lift ring-1 ring-border",
        STAGE_GRADIENT[currentLevel] ?? "from-zinc-100 via-zinc-50 to-white",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-fg-muted">
            Stage {currentLevel} · Your level
          </p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">{levelNameEn}</h1>
          <p className="font-arabic text-xl text-fg-muted" dir="rtl">
            {levelNameAr}
          </p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-soft ring-1 ring-border backdrop-blur">
          <span className="font-arabic text-3xl text-brand font-black">{currentLevel}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Level progress */}
        <ProgressTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Stage progress"
          value={`${booksInLevel} / ${booksRequired === 99 ? "∞" : booksRequired}`}
          progress={booksRequired === 99 ? null : levelProgress}
          tone="brand"
        />
        {/* Daily XP goal */}
        <ProgressTile
          icon={<Target className="h-4 w-4" />}
          label="Daily goal"
          value={`${xpToday} / ${dailyGoal} XP`}
          progress={goalProgress}
          tone="amber"
        />
        {/* Streak */}
        <ProgressTile
          icon={<Flame className="h-4 w-4" />}
          label={`Streak · best ${longestStreak}d`}
          value={`${streakDays} day${streakDays === 1 ? "" : "s"}`}
          progress={null}
          tone={streakDays > 0 ? "flame" : "neutral"}
          big
        />
      </div>
    </section>
  );
}

function ProgressTile({
  icon,
  label,
  value,
  progress,
  tone,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  progress: number | null;
  tone: "brand" | "amber" | "flame" | "neutral";
  big?: boolean;
}) {
  const barColor =
    tone === "brand"
      ? "bg-brand"
      : tone === "amber"
        ? "bg-accent"
        : tone === "flame"
          ? "bg-orange-500"
          : "bg-fg-muted";
  const iconColor =
    tone === "brand"
      ? "text-brand"
      : tone === "amber"
        ? "text-accent-fg"
        : tone === "flame"
          ? "text-orange-600"
          : "text-fg-muted";

  return (
    <div className="rounded-2xl bg-white/70 p-3 shadow-soft ring-1 ring-border backdrop-blur">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
        <span className={iconColor}>{icon}</span>
        {label}
      </div>
      <p className={cn("mt-1 font-extrabold text-fg", big ? "text-2xl" : "text-xl")}>{value}</p>
      {progress !== null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

