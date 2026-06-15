import Link from "next/link";
import {
  BookOpen,
  Lock,
  Check,
  Sparkles,
  BookMarked,
  AlertTriangle,
  Hourglass,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookNodeData } from "@/lib/db/queries/path";

const GENRE_TINT: Record<string, string> = {
  islamic: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  arabic_literature: "bg-amber-100 text-amber-900 ring-amber-200",
  translated: "bg-sky-100 text-sky-900 ring-sky-200",
  graded_reader: "bg-violet-100 text-violet-900 ring-violet-200",
  classical: "bg-rose-100 text-rose-900 ring-rose-200",
};

export function BookNode({ book, side }: { book: BookNodeData; side: "left" | "right" }) {
  const status = book.status;
  const locked = status === "locked";
  const completed = status === "completed";
  const failed = status === "failed_retry";
  const readingDone = status === "reading_done";
  const testing = status === "testing";
  const inProgress = status === "in_progress";

  let Icon = BookOpen;
  if (locked) Icon = Lock;
  else if (completed) Icon = Check;
  else if (failed) Icon = AlertTriangle;
  else if (testing) Icon = Loader2;
  else if (readingDone) Icon = Sparkles;
  else if (inProgress) Icon = Hourglass;

  const statusChip = (() => {
    if (completed && book.bestScore !== null)
      return { label: `${Math.round(book.bestScore)}% passed`, tone: "success" as const };
    if (completed) return { label: "Completed", tone: "success" as const };
    if (failed)
      return {
        label: book.bestScore !== null ? `${Math.round(book.bestScore)}% · retry` : "Retry",
        tone: "danger" as const,
      };
    if (testing) return { label: "Testing…", tone: "warn" as const };
    if (readingDone) return { label: "Ready to test", tone: "warn" as const };
    if (inProgress) return { label: "Reading", tone: "warn" as const };
    return null;
  })();

  return (
    <div
      className={cn(
        "relative flex items-center gap-4",
        side === "right" ? "flex-row" : "flex-row-reverse",
      )}
    >
      <Link
        href={locked ? "#" : `/book/${book.slug}`}
        aria-disabled={locked}
        tabIndex={locked ? -1 : 0}
        className={cn(
          "group relative grid h-20 w-20 shrink-0 place-items-center rounded-full ring-4 transition",
          locked && "cursor-not-allowed bg-zinc-200 text-zinc-400 ring-zinc-300",
          completed && "bg-brand text-brand-fg ring-emerald-300 shadow-glow-brand",
          failed && "bg-red-500 text-white ring-red-300 shadow-glow-danger",
          testing && "bg-accent text-accent-fg ring-amber-300 shadow-glow-amber",
          readingDone && "bg-accent text-accent-fg ring-amber-300 shadow-glow-amber animate-pulse",
          inProgress && "bg-white text-accent-fg ring-amber-300 shadow-soft",
          !locked &&
            !completed &&
            !failed &&
            !readingDone &&
            !testing &&
            !inProgress &&
            "bg-white text-fg ring-border shadow-soft hover:scale-105 hover:ring-brand hover:shadow-glow-brand",
        )}
      >
        <Icon
          className={cn("h-8 w-8", testing && "animate-spin")}
          strokeWidth={2.5}
        />
        {completed && (
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-xs font-bold text-amber-950 ring-2 ring-white">
            <BookMarked className="h-4 w-4" />
          </span>
        )}
        {book.attempts > 0 && !completed && (
          <span className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-fg text-[10px] font-bold text-white ring-2 ring-white">
            {book.attempts}
          </span>
        )}
      </Link>

      <div className={cn("max-w-[200px]", side === "left" && "text-right")}>
        {locked ? (
          <p className="text-sm font-semibold text-zinc-400">Locked</p>
        ) : (
          <>
            <p className="font-arabic text-lg leading-tight text-fg" dir="rtl">
              {book.titleAr}
            </p>
            <p className="text-xs text-fg-muted">{book.titleEn}</p>
            <div
              className={cn(
                "mt-1.5 flex flex-wrap gap-1",
                side === "left" && "justify-end",
              )}
            >
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                  GENRE_TINT[book.genre] ?? "bg-zinc-100 text-zinc-900 ring-zinc-200",
                )}
              >
                {labelForGenre(book.genre)}
              </span>
              {statusChip && (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                    statusChip.tone === "success" &&
                      "bg-emerald-100 text-emerald-900 ring-emerald-200",
                    statusChip.tone === "warn" &&
                      "bg-amber-100 text-amber-900 ring-amber-200",
                    statusChip.tone === "danger" &&
                      "bg-red-100 text-red-900 ring-red-200",
                  )}
                >
                  {statusChip.label}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function labelForGenre(g: string) {
  switch (g) {
    case "islamic":
      return "Islamic";
    case "arabic_literature":
      return "Arabic Lit";
    case "translated":
      return "Translated";
    case "graded_reader":
      return "Graded";
    case "classical":
      return "Classical";
    default:
      return g;
  }
}
