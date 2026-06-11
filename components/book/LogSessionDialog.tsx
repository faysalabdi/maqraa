"use client";

import { useState, useTransition } from "react";
import { BookOpen, Loader2, X } from "lucide-react";
import { logSession, markReadingDone } from "@/server/actions/reading";

type Props = {
  bookId: string;
  bookSlug: string;
  canMarkDone: boolean; // true when status is in_progress or reading_done
};

export default function LogSessionDialog({ bookId, bookSlug, canMarkDone }: Props) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setPages("");
    setMinutes("");
    setNote("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseInt(pages, 10);
    const m = parseInt(minutes, 10);
    if ((!p || p < 1) && (!m || m < 1)) {
      setError("Enter pages or minutes (or both).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await logSession({
        bookId,
        bookSlug,
        pages: p || 0,
        minutes: m || 0,
        note: note.trim() || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        reset();
        setOpen(false);
      }
    });
  }

  async function handleMarkDone() {
    startTransition(async () => {
      await markReadingDone(bookId, bookSlug);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg shadow-sm transition hover:bg-brand-dark"
      >
        <BookOpen className="h-4 w-4" /> Log a reading session
      </button>

      {canMarkDone && (
        <button
          onClick={handleMarkDone}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold transition hover:bg-bg-muted disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Mark as finished
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Log session</h2>
              <button onClick={() => { setOpen(false); reset(); }}>
                <X className="h-5 w-5 text-fg-muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Pages read</span>
                <input
                  type="number"
                  min={0}
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Minutes read</span>
                <input
                  type="number"
                  min={0}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="How did it go?"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
                />
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}

              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save session
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
