"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookUp, Check, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { parseEpubBook } from "@/lib/books/epub";
import { splitIntoChapters, type DraftChapter, type SplitMode } from "@/lib/books/split";
import { createBookWithChapters, type Genre } from "@/server/actions/admin";
import { slugify } from "@/lib/utils";

const GENRES: { value: Genre; label: string }[] = [
  { value: "graded_reader", label: "Graded reader" },
  { value: "islamic", label: "Islamic" },
  { value: "arabic_literature", label: "Arabic literature" },
  { value: "translated", label: "Translated" },
  { value: "classical", label: "Classical" },
];

const field =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
const label = "mb-1 block text-xs font-bold uppercase tracking-wider text-fg-muted";

export function AddBook({ levels }: { levels: { level: number; nameEn: string }[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, startSaving] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<DraftChapter[] | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState({
    titleAr: "",
    titleEn: "",
    authorAr: "",
    authorEn: "",
    slug: "",
    level: 1,
    genre: "graded_reader" as Genre,
    difficulty: 1,
    blurb: "",
  });

  // Paste fallback
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState("");
  const [mode, setMode] = useState<SplitMode>("heading");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setTitleEn(v: string) {
    setForm((f) => ({ ...f, titleEn: v, slug: slugEdited ? f.slug : slugify(v) }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setDone(null);
    const name = file.name.toLowerCase();
    try {
      setBusy(true);
      if (name.endsWith(".epub")) {
        const book = await parseEpubBook(file);
        setDrafts(book.chapters);
        const t = book.meta.title || file.name.replace(/\.epub$/i, "");
        const latin = /[a-z]/i.test(t);
        setForm((f) => ({
          ...f,
          titleAr: latin ? f.titleAr : t,
          titleEn: latin ? t : f.titleEn,
          authorAr: /[a-z]/i.test(book.meta.author) ? f.authorAr : book.meta.author,
          authorEn: /[a-z]/i.test(book.meta.author) ? book.meta.author : f.authorEn,
          slug: slugify(latin ? t : book.meta.author || ""),
        }));
      } else {
        const text = await file.text();
        setDrafts(splitIntoChapters(text, { mode: "heading" }));
        setForm((f) => ({ ...f, titleEn: f.titleEn || file.name.replace(/\.[^.]+$/, "") }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function previewPaste() {
    const res = splitIntoChapters(paste, { mode });
    if (res.length === 0) {
      setError("Nothing to split — paste some text first.");
      return;
    }
    setError(null);
    setDrafts(res);
  }

  function patch(i: number, p: Partial<DraftChapter>) {
    setDrafts((d) => (d ? d.map((c, j) => (j === i ? { ...c, ...p } : c)) : d));
  }
  function removeChapter(i: number) {
    setDrafts((d) => (d ? d.filter((_, j) => j !== i) : d));
  }
  function reset() {
    setDrafts(null);
    setForm((f) => ({ ...f, titleAr: "", titleEn: "", authorAr: "", authorEn: "", slug: "", blurb: "" }));
    setSlugEdited(false);
    setError(null);
  }

  function save() {
    if (!drafts || drafts.length === 0) return;
    setError(null);
    startSaving(async () => {
      try {
        const res = await createBookWithChapters(
          {
            slug: form.slug,
            level: Number(form.level),
            titleAr: form.titleAr,
            titleEn: form.titleEn || form.titleAr,
            authorAr: form.authorAr || undefined,
            authorEn: form.authorEn || undefined,
            blurb: form.blurb || `${form.titleEn || form.titleAr} — added to your library.`,
            difficulty: Number(form.difficulty),
            genre: form.genre,
          },
          drafts,
        );
        setDone(`Added “${form.titleEn || form.titleAr}” with ${res.chapters} chapters.`);
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save the book.");
      }
    });
  }

  // Idle: the dropzone.
  if (!drafts) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-card">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-bg-muted/40 px-6 py-12 text-center transition hover:border-brand hover:bg-brand/5"
        >
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-brand transition group-hover:scale-105">
            {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <BookUp className="h-7 w-7" />}
          </span>
          <span className="text-lg font-bold">{busy ? "Reading the book…" : "Add a book"}</span>
          <span className="max-w-sm text-sm text-fg-muted">
            Drop an <strong>.epub</strong> and we&apos;ll pull the title, author and real chapters
            automatically. Nothing to type.
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,.md,.htm,.html,application/epub+zip,text/plain"
          onChange={onFile}
          className="hidden"
        />
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setShowPaste((s) => !s)}
            className="text-sm font-semibold text-fg-muted hover:text-fg"
          >
            …or paste text instead
          </button>
          {done && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
              <Check className="h-4 w-4" /> {done}
            </span>
          )}
        </div>
        {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
        {showPaste && (
          <div className="mt-3 space-y-3 rounded-2xl border border-border p-3">
            <textarea
              className={`${field} min-h-40 font-arabic text-lg leading-loose`}
              dir="rtl"
              placeholder="ألصق نص الكتاب هنا…"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <select className={field} value={mode} onChange={(e) => setMode(e.target.value as SplitMode)}>
                <option value="heading">Split on chapter headings</option>
                <option value="separator">Split on a separator line</option>
                <option value="size">Split by length</option>
              </select>
              <button
                onClick={previewPaste}
                className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
              >
                Preview
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Review: details + chapters detected.
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand" />
          <p className="font-bold">
            {drafts.length} chapter{drafts.length === 1 ? "" : "s"} detected
          </p>
        </div>
        <button onClick={reset} className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
          <X className="h-4 w-4" /> Start over
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Title (Arabic)</label>
          <input className={`${field} font-arabic`} dir="rtl" value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} />
        </div>
        <div>
          <label className={label}>Title (English)</label>
          <input className={field} value={form.titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </div>
        <div>
          <label className={label}>Author</label>
          <input className={`${field} font-arabic`} dir="rtl" value={form.authorAr} onChange={(e) => set("authorAr", e.target.value)} placeholder="optional" />
        </div>
        <div>
          <label className={label}>
            URL slug <span className="font-normal normal-case text-fg-muted">· becomes /book/…</span>
          </label>
          <input
            className={field}
            value={form.slug}
            placeholder="animal-farm"
            onChange={(e) => {
              setSlugEdited(true);
              set("slug", e.target.value);
            }}
          />
        </div>
        <div>
          <label className={label}>Stage / level</label>
          <select className={field} value={form.level} onChange={(e) => set("level", Number(e.target.value))}>
            {levels.map((l) => (
              <option key={l.level} value={l.level}>
                {l.level} — {l.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Genre</label>
            <select className={field} value={form.genre} onChange={(e) => set("genre", e.target.value as Genre)}>
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Difficulty</label>
            <select className={field} value={form.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {"★".repeat(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border">
        <p className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
          Chapters — edit titles or remove junk
        </p>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {drafts.map((c, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bg-muted text-xs font-bold text-fg-muted">
                {i + 1}
              </span>
              <input
                className="font-arabic min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right outline-none transition focus:border-border"
                dir="rtl"
                value={c.titleAr}
                onChange={(e) => patch(i, { titleAr: e.target.value })}
              />
              <span className="hidden shrink-0 text-[11px] text-fg-muted sm:inline">
                {c.contentAr.length.toLocaleString()} ch
              </span>
              <button onClick={() => removeChapter(i)} className="shrink-0 text-fg-muted transition hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !form.titleAr || drafts.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-base font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        {saving ? "Adding to your library…" : `Add book · ${drafts.length} chapters`}
      </button>
    </div>
  );
}
