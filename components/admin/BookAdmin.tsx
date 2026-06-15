"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  addChapter,
  createBook,
  deleteBook,
  deleteChapter,
  type Genre,
} from "@/server/actions/admin";

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

const GENRES: { value: Genre; label: string }[] = [
  { value: "islamic", label: "Islamic" },
  { value: "arabic_literature", label: "Arabic literature" },
  { value: "translated", label: "Translated" },
  { value: "graded_reader", label: "Graded reader" },
  { value: "classical", label: "Classical" },
];

const inputCls =
  "w-full rounded-xl border border-border bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";
const labelCls = "block text-sm font-semibold text-fg-muted";

export function BookAdmin({
  books,
  chapters,
  levels,
}: {
  books: AdminBook[];
  chapters: AdminChapter[];
  levels: LevelOption[];
}) {
  return (
    <div className="space-y-8">
      <NewBookForm levels={levels} />
      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          Books <span className="text-fg-muted">({books.length})</span>
        </h2>
        {books.map((b) => (
          <BookRow
            key={b.id}
            book={b}
            chapters={chapters.filter((c) => c.bookId === b.id)}
          />
        ))}
        {books.length === 0 && (
          <p className="rounded-2xl bg-bg-muted p-6 text-center text-sm text-fg-muted">
            No books yet. Add one above.
          </p>
        )}
      </section>
    </div>
  );
}

function NewBookForm({ levels }: { levels: LevelOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: "",
    level: levels[0]?.level ?? 1,
    genre: "islamic" as Genre,
    difficulty: 1,
    titleAr: "",
    titleEn: "",
    authorAr: "",
    authorEn: "",
    recommendedPages: "",
    blurb: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createBook({
          slug: form.slug,
          level: Number(form.level),
          genre: form.genre,
          difficulty: Number(form.difficulty),
          titleAr: form.titleAr,
          titleEn: form.titleEn,
          authorAr: form.authorAr || undefined,
          authorEn: form.authorEn || undefined,
          recommendedPages: form.recommendedPages ? Number(form.recommendedPages) : undefined,
          blurb: form.blurb,
        });
        setForm((f) => ({
          ...f,
          slug: "",
          titleAr: "",
          titleEn: "",
          authorAr: "",
          authorEn: "",
          recommendedPages: "",
          blurb: "",
        }));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create book");
      }
    });
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-border">
      <h2 className="mb-4 text-lg font-bold">Add a book</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Slug</label>
          <input
            className={inputCls}
            placeholder="e.g. qasas-al-nabiyeen"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Stage / level</label>
          <select
            className={inputCls}
            value={form.level}
            onChange={(e) => set("level", Number(e.target.value))}
          >
            {levels.map((l) => (
              <option key={l.level} value={l.level}>
                {l.level} — {l.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Title (Arabic)</label>
          <input
            className={`${inputCls} font-arabic`}
            dir="rtl"
            value={form.titleAr}
            onChange={(e) => set("titleAr", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Title (English)</label>
          <input
            className={inputCls}
            value={form.titleEn}
            onChange={(e) => set("titleEn", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Author (Arabic)</label>
          <input
            className={`${inputCls} font-arabic`}
            dir="rtl"
            value={form.authorAr}
            onChange={(e) => set("authorAr", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Author (English)</label>
          <input
            className={inputCls}
            value={form.authorEn}
            onChange={(e) => set("authorEn", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Genre</label>
          <select
            className={inputCls}
            value={form.genre}
            onChange={(e) => set("genre", e.target.value as Genre)}
          >
            {GENRES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Difficulty (1–5)</label>
            <input
              type="number"
              min={1}
              max={5}
              className={inputCls}
              value={form.difficulty}
              onChange={(e) => set("difficulty", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>Pages</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              placeholder="optional"
              value={form.recommendedPages}
              onChange={(e) => set("recommendedPages", e.target.value)}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Blurb</label>
          <textarea
            className={`${inputCls} min-h-20`}
            value={form.blurb}
            onChange={(e) => set("blurb", e.target.value)}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> {pending ? "Creating…" : "Create book"}
      </button>
    </section>
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
            {book.titleEn} · Stage {book.level} · {book.chapterCount} chapters ·{" "}
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
          <AddChapterForm bookId={book.id} />
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
    return <p className="text-sm text-fg-muted">No chapters yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {chapters
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

function AddChapterForm({ bookId }: { bookId: string }) {
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
    <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
      <p className="text-sm font-semibold">Add chapter</p>
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
        className={`${inputCls} min-h-40 font-arabic text-lg leading-loose`}
        dir="rtl"
        placeholder="ألصق نص الفصل هنا…"
        value={contentAr}
        onChange={(e) => setContentAr(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> {pending ? "Saving…" : "Add chapter"}
      </button>
    </div>
  );
}

function DeleteBookButton({ bookId }: { bookId: string; disabled?: boolean }) {
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
