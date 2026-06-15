import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import type { LevelData } from "@/lib/db/queries/path";

const STAGE_ACCENT: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-sky-500",
  3: "bg-violet-500",
  4: "bg-amber-500",
  5: "bg-orange-500",
  6: "bg-rose-500",
  7: "bg-fuchsia-500",
  8: "bg-yellow-500",
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
  const accent = STAGE_ACCENT[level.level] ?? "bg-zinc-500";

  return (
    <div
      className={cn(
        "sticky top-[57px] z-10 -mx-4 mb-2 mt-8 flex items-center gap-3 bg-bg/85 px-4 py-2.5 backdrop-blur first:mt-0",
        isLocked && "opacity-70",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-soft",
          accent,
        )}
      >
        {level.level}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-extrabold leading-tight">{level.nameEn}</h2>
          <span className="font-arabic shrink-0 text-sm text-fg-muted" dir="rtl">
            {level.nameAr}
          </span>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          Stage {level.level}
        </p>
      </div>
      {isLocked ? (
        <Lock className="h-4 w-4 shrink-0 text-fg-muted" />
      ) : (
        <span className="shrink-0 rounded-full bg-bg-muted px-2.5 py-1 text-xs font-bold text-fg-muted">
          {completedCount}/{level.booksRequiredToClear >= 99 ? "∞" : level.booksRequiredToClear}
        </span>
      )}
    </div>
  );
}
