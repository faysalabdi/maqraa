import { cn } from "@/lib/utils";

/**
 * Maqra wordmark — the brand name in Arabic (مقرأ, "to read"), set in Amiri 700
 * (loaded app-wide via lib/fonts.ts → var(--font-amiri)). Renders live text, so
 * it stays crisp at any size and recolors with the theme where noted.
 *
 *   - "gradient" : gold→emerald sweep across the word (default, on light)
 *   - "tile"     : cream→gold word on an emerald rounded tile (app icon / dark)
 *   - "swash"    : solid emerald word over a gold calligraphic underline
 */
type Variant = "gradient" | "tile" | "swash";

const FONT = "var(--font-amiri), 'Amiri', serif";

export function Wordmark({
  variant = "gradient",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "tile") {
    return (
      <svg viewBox="0 0 460 220" className={cn("h-auto", className)} role="img" aria-label="Maqra">
        <defs>
          <linearGradient id="mq-tile" x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0" stopColor="#f4cf83" />
            <stop offset="0.5" stopColor="#fff" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="460" height="220" rx="48" className="fill-brand" />
        <text x="230" y="162" fontFamily={FONT} fontWeight="700" fontSize="128" textAnchor="middle" direction="rtl" fill="url(#mq-tile)">
          مقرأ
        </text>
      </svg>
    );
  }
  if (variant === "swash") {
    return (
      <svg viewBox="0 0 360 230" className={cn("h-auto", className)} role="img" aria-label="Maqra">
        <text x="180" y="178" fontFamily={FONT} fontWeight="700" fontSize="126" textAnchor="middle" direction="rtl" className="fill-brand">
          مقرأ
        </text>
        <path d="M62,208 C132,226 228,226 298,206" fill="none" className="stroke-accent" strokeWidth="7.5" strokeLinecap="round" />
        <circle cx="298" cy="206" r="5.4" className="fill-accent" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 360 230" className={cn("h-auto", className)} role="img" aria-label="Maqra">
      <defs>
        <linearGradient id="mq-grad" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#e3a72f" />
          <stop offset="0.45" stopColor="#19a06a" />
          <stop offset="1" stopColor="#0c7a51" />
        </linearGradient>
      </defs>
      <text x="180" y="188" fontFamily={FONT} fontWeight="700" fontSize="128" textAnchor="middle" direction="rtl" fill="url(#mq-grad)">
        مقرأ
      </text>
    </svg>
  );
}

/** Standalone mark (centered contexts: hero, sign-in). */
export function LogoMark({ className }: { className?: string }) {
  return <Wordmark variant="gradient" className={cn("h-10", className)} />;
}

/** Nav/header lockup — the gradient wordmark. */
export function Logo({ className }: { className?: string }) {
  return <Wordmark variant="gradient" className={cn("h-7 w-auto", className)} />;
}
