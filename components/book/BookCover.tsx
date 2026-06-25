import { cn } from "@/lib/utils";

// Genre-driven cover palettes — deep, premium gradients with cream ink. No
// image assets: the Arabic title set on a colored spine *is* the cover.
const GENRE: Record<string, { from: string; to: string; ink: string; accent: string }> = {
  islamic: {
    from: "oklch(0.42 0.13 158)",
    to: "oklch(0.24 0.08 165)",
    ink: "oklch(0.96 0.03 120)",
    accent: "oklch(0.8 0.14 85)",
  },
  arabic_literature: {
    from: "oklch(0.5 0.14 55)",
    to: "oklch(0.28 0.09 45)",
    ink: "oklch(0.97 0.03 80)",
    accent: "oklch(0.82 0.13 75)",
  },
  translated: {
    from: "oklch(0.46 0.13 255)",
    to: "oklch(0.26 0.09 270)",
    ink: "oklch(0.96 0.02 250)",
    accent: "oklch(0.8 0.1 230)",
  },
  graded_reader: {
    from: "oklch(0.5 0.15 300)",
    to: "oklch(0.28 0.1 295)",
    ink: "oklch(0.97 0.02 300)",
    accent: "oklch(0.82 0.12 320)",
  },
  classical: {
    from: "oklch(0.46 0.15 18)",
    to: "oklch(0.26 0.1 15)",
    ink: "oklch(0.97 0.03 30)",
    accent: "oklch(0.8 0.13 40)",
  },
};

const SIZES = {
  sm: { w: "w-16", title: "text-sm", author: "text-[8px]", pad: "p-2", motif: "text-2xl" },
  md: { w: "w-28", title: "text-lg", author: "text-[10px]", pad: "p-3", motif: "text-4xl" },
  lg: { w: "w-40", title: "text-2xl", author: "text-xs", pad: "p-4", motif: "text-6xl" },
} as const;

export function BookCover({
  titleAr,
  authorAr,
  authorEn,
  genre,
  size = "md",
  className,
}: {
  titleAr: string;
  authorAr?: string | null;
  authorEn?: string | null;
  genre: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const g = GENRE[genre] ?? GENRE.graded_reader;
  const s = SIZES[size];
  const author = authorAr || authorEn;

  return (
    <div
      className={cn(
        "relative aspect-[3/4] shrink-0 overflow-hidden rounded-lg shadow-card ring-1 ring-black/10",
        s.w,
        className,
      )}
      style={{ backgroundImage: `linear-gradient(150deg, ${g.from}, ${g.to})`, color: g.ink }}
    >
      {/* Spine (RTL: on the right edge). */}
      <div className="absolute inset-y-0 right-0 w-[6%] bg-black/25" />
      <div className="absolute inset-y-0 right-[6%] w-px bg-white/15" />
      {/* Faint motif. */}
      <span
        className={cn("pointer-events-none absolute -left-1 bottom-1 font-arabic opacity-10", s.motif)}
        aria-hidden
      >
        ۞
      </span>

      <div className={cn("flex h-full flex-col items-center justify-center pe-[8%] text-center", s.pad)}>
        <span
          className="font-arabic font-bold leading-snug"
          dir="rtl"
          style={{ fontSize: undefined }}
        >
          <span className={s.title}>{titleAr}</span>
        </span>
        {author && (
          <>
            <span className="my-2 h-px w-6" style={{ background: g.accent, opacity: 0.7 }} />
            <span className={cn("font-arabic opacity-80", s.author)} dir="rtl">
              {author}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
