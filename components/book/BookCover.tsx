import { cn } from "@/lib/utils";
import { TIERS, tierFor, type Tier } from "@maqraa/shared/src/tiers";

export { TIERS, tierFor, type Tier };

// Covers are coloured by tier so a shelf reads as one level at a glance:
// green = Beginner, indigo = Intermediate, gold = Advanced.
const TIER_COVER: Record<Tier, [string, string]> = {
  Beginner: ["#1aa66f", "#0b6644"],
  Intermediate: ["#4f63d8", "#2b3aa0"],
  Advanced: ["#c08a1e", "#855011"],
};

function coverColors(level?: number, band?: string): [string, string] {
  const tier: Tier =
    band && (TIERS as readonly string[]).includes(band)
      ? (band as Tier)
      : level != null
        ? tierFor(level)
        : "Beginner";
  return TIER_COVER[tier];
}

const SIZES = {
  sm: { w: "w-16", title: "text-sm", author: "text-[8px]", chip: "text-[8px] px-1 py-0.5" },
  md: { w: "w-28", title: "text-xl", author: "text-[10px]", chip: "text-[10px] px-1.5 py-0.5" },
  lg: { w: "w-40", title: "text-2xl", author: "text-xs", chip: "text-[11px] px-2 py-0.5" },
} as const;

export function BookCover({
  titleAr,
  authorAr,
  authorEn,
  level,
  band,
  size = "md",
  showBand = true,
  className,
}: {
  titleAr: string;
  authorAr?: string | null;
  authorEn?: string | null;
  genre?: string;
  level?: number;
  band?: string;
  size?: keyof typeof SIZES;
  showBand?: boolean;
  className?: string;
}) {
  const [c1, c2] = coverColors(level, band);
  const s = SIZES[size];
  const author = authorAr || authorEn;
  const bandLabel = band ?? (level != null ? tierFor(level) : null);

  return (
    <div
      className={cn(
        "relative aspect-[3/4] shrink-0 overflow-hidden rounded-2xl shadow-card ring-1 ring-black/10",
        s.w,
        className,
      )}
      style={{ backgroundImage: `linear-gradient(150deg, ${c1}, ${c2})`, color: "#fff" }}
    >
      {showBand && bandLabel && (
        <span
          className={cn(
            "absolute left-2 top-2 rounded-md bg-black/25 font-bold tracking-wide text-white/95 backdrop-blur-sm",
            s.chip,
          )}
        >
          {bandLabel}
        </span>
      )}
      <div className="flex h-full flex-col items-center justify-center px-3 text-center">
        <span className={cn("font-arabic font-bold leading-snug", s.title)} dir="rtl">
          {titleAr}
        </span>
        {author && (
          <span className={cn("font-arabic mt-1.5 opacity-75", s.author)} dir="rtl">
            {author}
          </span>
        )}
      </div>
    </div>
  );
}
