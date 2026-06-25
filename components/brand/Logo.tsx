import { cn } from "@/lib/utils";

/**
 * The Maqra mark: a stylized qāf (ق) whose bowl opens like a book, with the
 * letter's two dots reborn as golden XP sparks. Colours come from the theme
 * tokens (fill-brand / fill-accent), so it follows light/dark + palette swaps.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-9 w-9", className)} aria-hidden>
      <rect x="1" y="1" width="46" height="46" rx="13" className="fill-brand" />
      {/* open book — two pages, brand-coloured spine gap between them */}
      <path
        d="M23.3 17.4C18.8 14.6 13.4 14.4 9 16.1L9 33.2C13.4 31.5 18.8 31.7 23.3 34.4Z"
        fill="#fff"
        opacity="0.97"
      />
      <path
        d="M24.7 17.4C29.2 14.6 34.6 14.4 39 16.1L39 33.2C34.6 31.5 29.2 31.7 24.7 34.4Z"
        fill="#fff"
        opacity="0.82"
      />
      {/* qāf dots / XP sparks */}
      <circle cx="31.5" cy="10.2" r="2.4" className="fill-accent" />
      <circle cx="37.8" cy="12.4" r="1.6" className="fill-accent" />
    </svg>
  );
}

/** Wordmark lockup — Maqra (مقرأ). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="hidden items-baseline gap-1 sm:flex">
        <span className="font-serif text-lg font-semibold tracking-tight">Maqra</span>
        <span className="font-arabic text-sm text-fg-muted">مقرأ</span>
      </span>
    </span>
  );
}
