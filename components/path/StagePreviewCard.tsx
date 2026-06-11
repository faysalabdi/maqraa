import { cn } from "@/lib/utils";
import { Lock, BookOpen } from "lucide-react";

const STAGE_COLOR: Record<number, string> = {
  1: "from-emerald-50 to-white border-emerald-200",
  2: "from-sky-50 to-white border-sky-200",
  3: "from-violet-50 to-white border-violet-200",
  4: "from-amber-50 to-white border-amber-200",
  5: "from-orange-50 to-white border-orange-200",
  6: "from-rose-50 to-white border-rose-200",
  7: "from-fuchsia-50 to-white border-fuchsia-200",
  8: "from-yellow-100 to-white border-amber-300",
};

const STAGE_NUMBER_COLOR: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-900",
  2: "bg-sky-100 text-sky-900",
  3: "bg-violet-100 text-violet-900",
  4: "bg-amber-100 text-amber-900",
  5: "bg-orange-100 text-orange-900",
  6: "bg-rose-100 text-rose-900",
  7: "bg-fuchsia-100 text-fuchsia-900",
  8: "bg-yellow-200 text-amber-950",
};

export type StagePreviewBook = {
  id: string;
  titleAr: string;
  titleEn: string;
  authorEn: string | null;
};

export type StagePreviewData = {
  level: number;
  nameEn: string;
  nameAr: string;
  description: string;
  books: StagePreviewBook[];
};

export function StagePreviewCard({ stage }: { stage: StagePreviewData }) {
  const bookCount = stage.books.length;

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-gradient-to-br p-5 shadow-sm",
        STAGE_COLOR[stage.level] ?? "from-zinc-50 to-white border-zinc-200",
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-black",
            STAGE_NUMBER_COLOR[stage.level] ?? "bg-zinc-100 text-zinc-900",
          )}
        >
          {stage.level}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">{stage.nameEn}</h2>
          <p className="font-arabic text-base text-fg-muted" dir="rtl">
            {stage.nameAr}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-fg-muted ring-1 ring-border backdrop-blur">
          <BookOpen className="h-3 w-3" />
          {bookCount}
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{stage.description}</p>

      {stage.books.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
          {stage.books.slice(0, 4).map((b) => (
            <li key={b.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-arabic truncate text-base" dir="rtl">
                {b.titleAr}
              </span>
              <span className="truncate text-xs text-fg-muted">{b.titleEn}</span>
            </li>
          ))}
          {stage.books.length > 4 && (
            <li className="pt-1 text-xs text-fg-muted">
              + {stage.books.length - 4} more
            </li>
          )}
        </ul>
      )}

      {stage.level >= 7 && (
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted ring-1 ring-border">
          <Lock className="h-2.5 w-2.5" /> Advanced
        </span>
      )}
    </div>
  );
}
