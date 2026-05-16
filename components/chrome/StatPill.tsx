import { cn } from "@/lib/utils";

type Tone = "brand" | "amber" | "flame" | "neutral" | "danger";

const TONE: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand ring-brand/20",
  amber: "bg-accent/15 text-accent-fg ring-accent/30",
  flame: "bg-orange-100 text-orange-700 ring-orange-200",
  neutral: "bg-bg-muted text-fg-muted ring-border",
  danger: "bg-red-100 text-red-700 ring-red-200",
};

export function StatPill({
  icon,
  children,
  tone = "neutral",
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 transition",
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
