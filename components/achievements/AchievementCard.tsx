import {
  Footprints,
  BookOpen,
  ScrollText,
  Languages,
  Trophy,
  Flame,
  Snowflake,
  Shuffle,
  Scroll,
  BookMarked,
  Moon,
  Award,
  Lock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  footprints: Footprints,
  "book-open": BookOpen,
  "scroll-text": ScrollText,
  languages: Languages,
  trophy: Trophy,
  flame: Flame,
  snowflake: Snowflake,
  shuffle: Shuffle,
  scroll: Scroll,
  "book-marked": BookMarked,
  moon: Moon,
  award: Award,
};

export type AchievementCardData = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  description: string;
  icon: string;
  xpReward: number;
  earnedAt: Date | null;
};

export function AchievementCard({ ach }: { ach: AchievementCardData }) {
  const Icon = ICONS[ach.icon] ?? Award;
  const earned = ach.earnedAt !== null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 shadow-soft ring-1 transition",
        earned
          ? "bg-gradient-to-br from-amber-50 via-white to-white ring-amber-200"
          : "bg-bg-muted ring-border grayscale",
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-soft",
            earned ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-zinc-300",
          )}
        >
          {earned ? <Icon className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-base font-extrabold">{ach.nameEn}</p>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-fg-muted">
              <Zap className="h-3 w-3" />
              {ach.xpReward}
            </span>
          </div>
          <p className="font-arabic text-sm text-fg-muted" dir="rtl">
            {ach.nameAr}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">{ach.description}</p>
          {earned && ach.earnedAt && (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
              Earned {ach.earnedAt.toLocaleDateString(undefined, { dateStyle: "medium" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
