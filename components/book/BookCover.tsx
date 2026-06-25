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

const BANDS = ["A1", "A2", "B1", "B2", "C1", "C2", "C2", "C2", "C2"];
export function bandFor(level: number): string {
  return BANDS[Math.min(BANDS.length, Math.max(1, level)) - 1];
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
  const bandLabel = band ?? (level != null ? bandFor(level) : null);

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
