"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, Plus, Trash2 } from "lucide-react";
import { addChapter, deleteBook, deleteChapter } from "@/server/actions/admin";
import { ImportPanel } from "@/components/admin/ImportPanel";

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

export function BookAdmin({
  books,
  chapters,
  levels,
}: {
  books: AdminBook[];
  chapters: AdminChapter[];
  levels: LevelOption[];
}) {
  const usedLevels = levels.filter((l) => books.some((b) => b.level === l.level));

  if (books.length === 0) {
    return (
      <p className="rounded-2xl bg-bg-muted p-6 text-center text-sm text-fg-muted">
        No books in your library yet. Add one above by dropping an EPUB.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {usedLevels.map((l) => (
        <section key={l.level} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-fg-muted">
            Stage {l.level} · {l.nameEn}
          </h2>
          {books
            .filter((b) => b.level === l.level)
            .map((b) => (
              <BookRow
                key={b.id}
                book={b}
                chapters={chapters.filter((c) => c.bookId === b.id)}
              />
            ))}
        </section>
      ))}
    </div>
  );
}

function BookRow({ book, chapters }: { book: AdminBook; chapters: AdminChapter[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-white shadow-soft ring-1 ring-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-brand">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-arabic truncate text-lg font-bold" dir="rtl">
            {book.titleAr}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {book.titleEn} · {book.chapterCount} chapters ·{" "}
            <span className={book.hasFullText ? "text-brand" : "text-amber-600"}>
              {book.hasFullText ? "readable" : "no text yet"}
            </span>
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-fg-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <ChapterList chapters={chapters} bookId={book.id} />
          <ImportPanel bookId={book.id} />
          <ManualAddChapter bookId={book.id} />
          <DeleteBookButton bookId={book.id} />
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
    <ul className="space-y-2">
      {chapters
        .slice()
        .sort((a, b) => a.chapterNumber - b.chapterNumber)
        .map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl bg-bg-muted px-3 py-2 text-sm"
          >
            <span className="font-bold text-fg-muted">{c.chapterNumber}</span>
            <span className="font-arabic flex-1 truncate" dir="rtl">
              {c.titleAr}
            </span>
            <span className="truncate text-xs text-fg-muted">{c.titleEn}</span>
            <button
              title="Delete chapter"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteChapter(c.id, bookId);
                  router.refresh();
                })
              }
              className="text-red-500 transition hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
    </ul>
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
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-bg-muted disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {pending ? "Saving…" : "Add chapter"}
        </button>
      </div>
    </details>
  );
}

function DeleteBookButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        onClick={() => {
          if (!confirm("Delete this book and all its chapters? This cannot be undone.")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteBook(bookId);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to delete book");
            }
          });
        }}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" /> Delete book
      </button>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
