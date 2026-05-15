import Link from "next/link";
import { BookOpen, Lock, Check, Sparkles, BookMarked } from "lucide-react";
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
  const locked = book.status === "locked";
  const completed = book.status === "completed";
  const inProgress = ["in_progress", "reading_done", "testing"].includes(book.status);

  const Icon = locked ? Lock : completed ? Check : inProgress ? Sparkles : BookOpen;

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
        className={cn(
          "group relative grid h-20 w-20 shrink-0 place-items-center rounded-full ring-4 transition",
          locked && "cursor-not-allowed bg-zinc-200 text-zinc-400 ring-zinc-300",
          completed && "bg-brand text-brand-fg ring-emerald-300 shadow-lg shadow-emerald-200",
          inProgress && "bg-accent text-fg ring-amber-300 shadow-lg shadow-amber-200 animate-pulse",
          !locked &&
            !completed &&
            !inProgress &&
            "bg-white text-fg ring-border hover:scale-105 hover:ring-brand",
        )}
      >
        <Icon className="h-8 w-8" strokeWidth={2.5} />
        {completed && (
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-xs font-bold text-amber-950 ring-2 ring-white">
            <BookMarked className="h-4 w-4" />
          </span>
        )}
      </Link>

      <div className={cn("max-w-[180px]", side === "left" && "text-right")}>
        {locked ? (
          <p className="text-sm font-semibold text-zinc-400">Locked</p>
        ) : (
          <>
            <p className="font-arabic text-lg leading-tight text-fg" dir="rtl">
              {book.titleAr}
            </p>
            <p className="text-xs text-fg-muted">{book.titleEn}</p>
            <span
              className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                GENRE_TINT[book.genre] ?? "bg-zinc-100 text-zinc-900 ring-zinc-200",
              )}
            >
              {labelForGenre(book.genre)}
            </span>
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
