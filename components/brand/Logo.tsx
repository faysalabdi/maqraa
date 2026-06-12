import { cn } from "@/lib/utils";

/** The Arabic XP mark: an open book with golden sparks, on emerald. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} aria-hidden>
      <defs>
        <linearGradient id="axp-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10915f" />
          <stop offset="100%" stopColor="#0a6e47" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#axp-g)" />
      <path d="M12 20c6-3 12-3 18 0v26c-6-3-12-3-18 0z" fill="#fff" opacity="0.92" />
      <path d="M52 20c-6-3-12-3-18 0v26c6-3 12-3 18 0z" fill="#fff" opacity="0.78" />
      <circle cx="45" cy="13" r="3.4" fill="#f6c454" />
      <circle cx="53" cy="18" r="2.3" fill="#f6c454" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-bold", className)}>
      <LogoMark />
      <span className="hidden text-base sm:inline">
        arabic<span className="text-brand">·xp</span>
      </span>
    </span>
  );
}
