import { cn } from "@/lib/utils";

// Flat two-stop gradient covers, per genre. Cream/white ink. The Arabic title
// set on the gradient is the cover; a difficulty band chip sits top-left.
const COVER: Record<string, [string, string]> = {
  graded_reader: ["#16a06a", "#0b6644"],
  islamic: ["#3f5bd9", "#283c98"],
  classical: ["#c08a1e", "#855a11"],
  translated: ["#7c5cd0", "#4a3499"],
  arabic_literature: ["#1f9a8a", "#125a50"],
};

export const TIERS = ["Beginner", "Intermediate", "Advanced"] as const;
export type Tier = (typeof TIERS)[number];

// Coarse difficulty tier from the advisory `level` band. Beginner = fully
// diacritized starters; Intermediate = matns / classic tales; Advanced = dense
// classical prose. This is what readers see ("what level am I at"), not CEFR.
export function tierFor(level: number): Tier {
  if (level <= 2) return "Beginner";
  if (level <= 4) return "Intermediate";
  return "Advanced";
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
  genre,
  level,
  band,
  size = "md",
  showBand = true,
  className,
}: {
  titleAr: string;
  authorAr?: string | null;
  authorEn?: string | null;
  genre: string;
  level?: number;
  band?: string;
  size?: keyof typeof SIZES;
  showBand?: boolean;
  className?: string;
}) {
  const [c1, c2] = COVER[genre] ?? COVER.graded_reader;
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
