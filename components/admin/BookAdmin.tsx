"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Settings2, Trash2 } from "lucide-react";
import { addChapter, deleteBook, deleteChapter } from "@/server/actions/admin";
import { ImportPanel } from "@/components/admin/ImportPanel";
import { BookCover, tierFor, TIERS } from "@/components/book/BookCover";
import { cn } from "@/lib/utils";

export type AdminBook = {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  level: number;
  genre: string;
  hasFullText: boolean;
  chapterCount: number;
};

export type AdminChapter = {
  id: string;
  bookId: string;
  chapterNumber: number;
  titleAr: string;
  titleEn: string;
};

export type LevelOption = { level: number; nameEn: string };

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";

export function BookAdmin({ books, chapters }: { books: AdminBook[]; chapters: AdminChapter[] }) {
  if (books.length === 0) {
    return (
      <p className="rounded-2xl bg-bg-muted p-6 text-center text-sm text-fg-muted">
        No books in your library yet. Add one above by dropping an EPUB.
      </p>
    );
  }

  return (
    <div className="space-y-7">
      {TIERS.map((tier) => {
        const tierBooks = books.filter((b) => tierFor(b.level) === tier);
        if (tierBooks.length === 0) return null;
        return (
          <section key={tier} className="space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-fg-muted">{tier}</h2>
            {tierBooks.map((b) => (
              <BookRow key={b.id} book={b} chapters={chapters.filter((c) => c.bookId === b.id)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function BookRow({ book, chapters }: { book: AdminBook; chapters: AdminChapter[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function del() {
    if (!confirm(`Delete "${book.titleEn || book.titleAr}" and all its chapters? This cannot be undone.`))
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteBook(book.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete book");
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-soft ring-1 ring-border">
      <div className="flex items-center gap-3 p-3">
        <BookCover titleAr={book.titleAr} genre={book.genre} size="sm" className="w-9" />
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <p className="font-arabic truncate text-base font-bold" dir="rtl">
            {book.titleAr}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {book.titleEn} · {book.chapterCount} ch ·{" "}
            <span className={book.hasFullText ? "text-brand" : "text-amber-600"}>
              {book.hasFullText ? "readable" : "no text"}
            </span>
          </p>
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Manage chapters"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold transition",
            open ? "bg-brand/10 text-brand" : "text-fg-muted hover:bg-bg-muted",
          )}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Manage</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
        </button>
        <button
          onClick={del}
          disabled={pending}
          title="Delete book"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-danger transition hover:bg-danger/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="px-4 pb-3 text-sm font-medium text-danger">{error}</p>}

      {open && (
        <div className="space-y-4 border-t border-border bg-bg-muted/30 p-4">
          <ChapterList chapters={chapters} bookId={book.id} />
          <ImportPanel bookId={book.id} />
          <ManualAddChapter bookId={book.id} />
        </div>
      )}
    </div>
  );
}

function ChapterList({ chapters, bookId }: { chapters: AdminChapter[]; bookId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (chapters.length === 0) {
    return <p className="text-sm text-fg-muted">No chapters yet. Upload an EPUB below.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border">
      <ul className="max-h-72 divide-y divide-border overflow-y-auto bg-surface">
        {chapters
          .slice()
          .sort((a, b) => a.chapterNumber - b.chapterNumber)
          .map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-6 shrink-0 text-center font-bold text-fg-muted">
                {c.chapterNumber}
              </span>
              <span className="font-arabic min-w-0 flex-1 truncate" dir="rtl">
                {c.titleAr}
              </span>
              <span className="hidden truncate text-xs text-fg-muted sm:inline">{c.titleEn}</span>
              <button
                title="Delete chapter"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteChapter(c.id, bookId);
                    router.refresh();
                  })
                }
                className="shrink-0 text-fg-muted transition hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

function ManualAddChapter({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentAr, setContentAr] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await addChapter({ bookId, titleAr, titleEn, contentAr });
        setTitleAr("");
        setTitleEn("");
        setContentAr("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add chapter");
      }
    });
  }

  return (
    <details className="rounded-2xl border border-dashed border-border">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-fg-muted">
        Add a single chapter manually
      </summary>
      <div className="space-y-3 border-t border-border p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={`${inputCls} font-arabic`}
            dir="rtl"
            placeholder="عنوان الفصل"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Chapter title (English)"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </div>
        <textarea
          className={`${inputCls} min-h-32 font-arabic text-lg leading-loose`}
          dir="rtl"
          placeholder="نص الفصل…"
          value={contentAr}
          onChange={(e) => setContentAr(e.target.value)}
        />
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-bg-muted disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {pending ? "Saving…" : "Add chapter"}
        </button>
      </div>
    </details>
  );
}
