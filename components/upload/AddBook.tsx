"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookUp, Check, Eye, FileText, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { parseEpubBook } from "@/lib/books/epub";
import { assessChapters } from "@/lib/books/quality";
import { splitIntoChapters, type DraftChapter, type SplitMode } from "@/lib/books/split";
import { analyzeBookDraft, createBookWithChapters, type Genre } from "@/server/actions/admin";
import { TIERS, tierFor, type Tier } from "@/components/book/BookCover";
import { slugify } from "@/lib/utils";

// The catalogue stores a numeric `level`; the UI only exposes the three tiers.
const TIER_LEVEL: Record<Tier, number> = { Beginner: 1, Intermediate: 3, Advanced: 5 };

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

export function AddBook({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, startSaving] = useTransition();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

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

  // Flag garbled scans (bad OCR-to-EPUB conversions) before they become a book.
  const quality = useMemo(() => (drafts ? assessChapters(drafts) : null), [drafts]);

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
    if (file.size > 30 * 1024 * 1024) {
      setError("That file is over 30 MB — too large to parse in the browser. Try a smaller EPUB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
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

  async function runAi() {
    if (!drafts || drafts.length === 0) return;
    setAiBusy(true);
    setError(null);
    const pages = drafts;
    try {
      const a = await analyzeBookDraft(form.titleEn || form.titleAr || "Untitled", pages);
      setForm((f) => ({ ...f, level: a.level, genre: a.genre, difficulty: a.difficulty, blurb: a.blurb_en }));

      // Rebuild chapters by merging the page ranges the AI returned. The ranges
      // must form ONE contiguous block (no gaps between chapters) so no real
      // content is lost; the block may start/end inside the book, which drops
      // leading/trailing junk (cover, copyright, TOC, about-the-author).
      // If anything looks off, keep the original pages untouched.
      const ranges = [...a.chapters].sort((x, y) => x.first_page - y.first_page);
      let ok = ranges.length > 0 && ranges[0].first_page >= 1;
      for (let i = 0; ok && i < ranges.length; i++) {
        const r = ranges[i];
        if (r.last_page < r.first_page || r.last_page > pages.length) ok = false;
        if (i > 0 && r.first_page !== ranges[i - 1].last_page + 1) ok = false;
      }
      if (ok) {
        const merged: DraftChapter[] = ranges.map((r) => ({
          titleAr: r.title_ar,
          titleEn: r.title_en,
          contentAr: pages
            .slice(r.first_page - 1, r.last_page)
            .map((p) => p.contentAr)
            .join("\n\n"),
        }));
        setDrafts(merged);
      } else {
        setError("AI couldn't cleanly re-chapter this book; kept the original split. Level/genre still applied.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analysis failed.");
    } finally {
      setAiBusy(false);
    }
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
          className="group flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-bg-muted/30 px-6 py-16 text-center transition hover:border-brand hover:bg-brand/5"
        >
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-brand transition group-hover:scale-105">
            {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <BookUp className="h-7 w-7" />}
          </span>
          {busy ? (
            <span className="text-lg font-bold">Reading the book…</span>
          ) : (
            <>
              <span className="text-xl font-bold">
                Drop your <span className="text-brand">.epub</span> here
              </span>
              <span className="text-sm text-fg-muted">or click to browse — parsed locally with jszip</span>
              <span className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-fg shadow-glow-brand transition group-hover:bg-brand-dark">
                Choose file
              </span>
            </>
          )}
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

      {quality && !quality.ok && (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">This looks like a low-quality scan.</p>
            <p className="mt-1">
              The text is likely garbled
              {quality.ocrBanners > 0 ? " (it carries OCR accuracy notes)" : ""} and won&apos;t read
              or translate well. EPUBs made from scanned PDFs rarely work — try a digital (reflowable)
              EPUB instead. You can still add it, but the reading experience will be poor.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={runAi}
        disabled={aiBusy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-iris to-brand py-3 text-sm font-bold text-brand-fg shadow-soft transition hover:opacity-95 disabled:opacity-60"
      >
        {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {aiBusy ? "Reading the book…" : "Auto-fill difficulty, genre & chapter titles with AI"}
      </button>

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
        {/* Difficulty + genre place a book in the public catalogue, so only admins
            grade them. A reader's own uploads go to their private shelf as-is. */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Difficulty</label>
              <select
                className={field}
                value={tierFor(form.level)}
                onChange={(e) => set("level", TIER_LEVEL[e.target.value as Tier])}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
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
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border">
        <p className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
          Chapters — edit titles or remove junk
        </p>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {drafts.map((c, i) => (
            <li key={i} className="px-3 py-2">
              <div className="flex items-center gap-3">
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
                <button
                  onClick={() => setPreviewIdx((p) => (p === i ? null : i))}
                  title="Preview text"
                  className={`shrink-0 transition ${previewIdx === i ? "text-brand" : "text-fg-muted hover:text-brand"}`}
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => removeChapter(i)} className="shrink-0 text-fg-muted transition hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {previewIdx === i && (
                <div
                  className="font-arabic mt-2 max-h-60 overflow-y-auto rounded-xl bg-bg-muted p-3 text-base leading-loose"
                  dir="rtl"
                >
                  {c.contentAr.slice(0, 2000)}
                  {c.contentAr.length > 2000 ? " …" : ""}
                </div>
              )}
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
