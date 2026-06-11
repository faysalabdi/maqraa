import {
  CheckCircle2,
  Hourglass,
  Sparkles,
  AlertTriangle,
  BookOpen,
  Lock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookStatus } from "@/lib/db/queries/path";

type BannerStyle = {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  tone: "success" | "warn" | "danger" | "neutral" | "muted";
};

export function BookStatusBanner({
  status,
  bestScore,
  attempts,
}: {
  status: BookStatus | null;
  bestScore: number | null;
  attempts: number;
}) {
  const cfg = configFor(status, bestScore, attempts);

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl px-5 py-4 ring-1",
        cfg.tone === "success" && "bg-emerald-50 text-emerald-900 ring-emerald-200",
        cfg.tone === "warn" && "bg-amber-50 text-amber-900 ring-amber-200",
        cfg.tone === "danger" && "bg-red-50 text-red-900 ring-red-200",
        cfg.tone === "neutral" && "bg-bg-muted text-fg ring-border",
        cfg.tone === "muted" && "bg-bg-muted text-fg-muted ring-border",
      )}
    >
      <span
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white",
          cfg.tone === "success" && "bg-emerald-500",
          cfg.tone === "warn" && "bg-amber-500",
          cfg.tone === "danger" && "bg-red-500",
          cfg.tone === "neutral" && "bg-fg",
          cfg.tone === "muted" && "bg-zinc-400",
        )}
      >
        <cfg.Icon className="h-6 w-6" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-extrabold leading-tight">{cfg.label}</p>
        <p className="text-sm leading-snug opacity-80">{cfg.detail}</p>
      </div>
      {bestScore !== null && (
        <div className="hidden flex-col items-end text-right sm:flex">
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Best</p>
          <p className="text-2xl font-black">{Math.round(bestScore)}%</p>
        </div>
      )}
    </div>
  );
}

function configFor(
  status: BookStatus | null,
  bestScore: number | null,
  attempts: number,
): BannerStyle {
  switch (status) {
    case "completed":
      return {
        Icon: CheckCircle2,
        label: "Book completed",
        detail: bestScore !== null
          ? `Best score ${Math.round(bestScore)}% · ${attempts} attempt${attempts === 1 ? "" : "s"}`
          : "Test passed — nice work.",
        tone: "success",
      };
    case "failed_retry":
      return {
        Icon: AlertTriangle,
        label: "Test failed — retry available",
        detail: bestScore !== null
          ? `Best so far ${Math.round(bestScore)}% · ${attempts} attempt${attempts === 1 ? "" : "s"}. Re-read trouble spots, then try again.`
          : "Re-read trouble spots, then try again.",
        tone: "danger",
      };
    case "testing":
      return {
        Icon: Loader2,
        label: "Test in progress",
        detail: "Pick up where you left off.",
        tone: "warn",
      };
    case "reading_done":
      return {
        Icon: Sparkles,
        label: "Ready for the test",
        detail: "12 questions, ≥70% to pass. Sign of the book is enough — no notes needed.",
        tone: "warn",
      };
    case "in_progress":
      return {
        Icon: Hourglass,
        label: "Reading in progress",
        detail: "Mark as finished when you're done with the whole book.",
        tone: "warn",
      };
    case "unlocked":
      return {
        Icon: BookOpen,
        label: "Ready to read",
        detail: "Start whenever. There's no clock.",
        tone: "neutral",
      };
    case "locked":
      return {
        Icon: Lock,
        label: "Locked",
        detail: "Reach this stage to unlock.",
        tone: "muted",
      };
    default:
      return {
        Icon: BookOpen,
        label: "Not started",
        detail: "Sign in to track this book.",
        tone: "muted",
      };
  }
}
