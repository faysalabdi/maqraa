import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import type { LevelData } from "@/lib/db/queries/path";

const STAGE_COLOR: Record<number, string> = {
  1: "from-emerald-100 to-emerald-50 text-emerald-900",
  2: "from-sky-100 to-sky-50 text-sky-900",
  3: "from-violet-100 to-violet-50 text-violet-900",
  4: "from-amber-100 to-amber-50 text-amber-900",
  5: "from-orange-100 to-orange-50 text-orange-900",
  6: "from-rose-100 to-rose-50 text-rose-900",
  7: "from-fuchsia-100 to-fuchsia-50 text-fuchsia-900",
  8: "from-yellow-200 to-amber-100 text-amber-950",
};

export function StageBanner({
  level,
  isLocked,
  completedCount,
}: {
  level: LevelData;
  isLocked: boolean;
  completedCount: number;
}) {
  return (
    <div
      className={cn(
        "relative my-6 overflow-hidden rounded-3xl bg-gradient-to-b p-6 shadow-sm ring-1 ring-border",
        STAGE_COLOR[level.level] ?? "from-zinc-100 to-zinc-50 text-zinc-900",
        isLocked && "opacity-60",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
            Stage {level.level}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold">{level.nameEn}</h2>
          <p className="font-arabic text-xl opacity-80" dir="rtl">
            {level.nameAr}
          </p>
        </div>
        {isLocked ? (
          <Lock className="h-8 w-8 opacity-60" />
        ) : (
          <div className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold backdrop-blur">
            {completedCount} / {level.booksRequiredToClear}
          </div>
        )}
      </div>
      {!isLocked && (
        <p className="mt-3 max-w-prose text-sm leading-relaxed opacity-90">{level.description}</p>
      )}
    </div>
  );
}
