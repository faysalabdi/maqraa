"use client";

import Link from "next/link";
import { useTransition } from "react";
import { BookOpen, CheckCircle2, ExternalLink, FileText, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteText, setTextLevel } from "@/server/actions/texts";

export function TextCard({
  text,
}: {
  text: {
    id: string;
    title: string;
    kind: string;
    level: number | null;
    sourceUrl: string | null;
    wordCount: number;
    currentSection: number;
    totalSections: number;
    completedCount: number;
    createdAt: string;
    lastReadAt: string | null;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const pct = Math.round((text.completedCount / Math.max(1, text.totalSections)) * 100);
  const isFinished = text.totalSections > 0 && text.completedCount >= text.totalSections;

  const icon =
    text.kind === "generated" ? (
      <Wand2 className="h-5 w-5" />
    ) : text.kind === "pdf" ? (
      <FileText className="h-5 w-5" />
    ) : (
      <BookOpen className="h-5 w-5" />
    );

  return (
    <div
      className={cn(
        "rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 transition",
        isFinished ? "ring-emerald-300 hover:ring-emerald-400" : "ring-border hover:ring-brand",
      )}
    >
      <div className="flex items-center gap-3">
        <Link
          href={`/texts/${text.id}`}
          className={cn(
            "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            isFinished
              ? "bg-emerald-100 text-emerald-700"
              : text.kind === "generated"
                ? "bg-violet-100 text-violet-600"
                : text.kind === "pdf"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-brand",
          )}
        >
          {isFinished ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </Link>
        <Link href={`/texts/${text.id}`} className="min-w-0 flex-1">
          <p className="font-arabic truncate text-lg font-semibold" dir="rtl">
            {text.title}
          </p>
          <p className="text-xs text-fg-muted">
            {isFinished ? (
              <span className="font-semibold text-emerald-700">Finished · </span>
            ) : (
              text.kind === "generated" && "AI story · "
            )}
            {text.wordCount.toLocaleString()} words
            {!isFinished && text.totalSections > 1 && ` · section ${text.currentSection + 1}/${text.totalSections}`}
          </p>
        </Link>
        <select
          value={text.level ?? ""}
          onChange={(e) =>
            startTransition(async () => {
              await setTextLevel(text.id, Number(e.target.value));
            })
          }
          disabled={isPending}
          title="Level this text counts toward on your path"
          className="shrink-0 rounded-lg border border-border bg-bg-muted px-1.5 py-1 text-xs font-bold text-fg-muted outline-none transition hover:text-fg focus:ring-2 focus:ring-brand"
        >
          {text.level == null && <option value="">Lv ?</option>}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => (
            <option key={l} value={l}>
              Lv {l}
            </option>
          ))}
        </select>
        {text.sourceUrl && (
          <a
            href={text.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
            title="Open original"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          onClick={() => {
            if (confirm("Delete this text? Saved words stay in your deck.")) {
              startTransition(() => deleteText(text.id));
            }
          }}
          disabled={isPending}
          className="rounded-lg p-2 text-fg-muted transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {text.totalSections > 1 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isFinished ? "bg-emerald-500" : "bg-brand",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
