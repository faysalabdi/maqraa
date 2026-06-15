"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Plus, Trash2, Wand2, X } from "lucide-react";
import { addChapters } from "@/server/actions/admin";
import { splitIntoChapters, type DraftChapter, type SplitMode } from "@/lib/books/split";
import { parseEpub } from "@/lib/books/epub";

const inputCls =
  "w-full rounded-xl border border-border bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";

export function ImportPanel({ bookId }: { bookId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, startSaving] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [mode, setMode] = useState<SplitMode>("heading");
  const [separator, setSeparator] = useState("***");
  const [chars, setChars] = useState(1500);
  const [drafts, setDrafts] = useState<DraftChapter[] | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNote(null);
    setDrafts(null);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".epub")) {
        setBusy(true);
        const chapters = await parseEpub(file);
        setDrafts(chapters);
        setNote(`Found ${chapters.length} chapters in “${file.name}”. Review and edit below.`);
      } else {
        const content = await file.text();
        setText(content);
        setNote(`Loaded “${file.name}”. Pick how to split it, then preview.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function preview() {
    setError(null);
    const result = splitIntoChapters(text, { mode, separator, charsPerChapter: chars });
    if (result.length === 0) {
      setError("Nothing to split — paste some text or load a file first.");
      return;
    }
    setDrafts(result);
    setNote(`${result.length} chapters detected. Edit titles or remove any junk, then save.`);
  }

  function patch(i: number, p: Partial<DraftChapter>) {
    setDrafts((d) => (d ? d.map((c, j) => (j === i ? { ...c, ...p } : c)) : d));
  }
  function remove(i: number) {
    setDrafts((d) => (d ? d.filter((_, j) => j !== i) : d));
  }

  function save() {
    if (!drafts || drafts.length === 0) return;
    setError(null);
    startSaving(async () => {
      try {
        const res = await addChapters(bookId, drafts);
        setDrafts(null);
        setText("");
        setNote(`Added ${res.count} chapters.`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save chapters.");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-brand" />
        <p className="text-sm font-bold">Import chapters</p>
      </div>

      {/* File drop */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {busy ? "Reading…" : "Upload .epub or .txt"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,.md,.htm,.html,application/epub+zip,text/plain"
          onChange={onFile}
          className="hidden"
        />
        <span className="text-xs text-fg-muted">
          EPUBs are split into chapters automatically. Text files use the splitter below.
        </span>
      </div>

      {/* Paste + split controls */}
      <details className="rounded-xl border border-border bg-white">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">
          …or paste the whole book
        </summary>
        <div className="space-y-3 border-t border-border p-3">
          <textarea
            className={`${inputCls} min-h-40 font-arabic text-lg leading-loose`}
            dir="rtl"
            placeholder="ألصق نص الكتاب كاملاً هنا…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-fg-muted">Split by</span>
              <select
                className={inputCls}
                value={mode}
                onChange={(e) => setMode(e.target.value as SplitMode)}
              >
                <option value="heading">Chapter headings (الفصل، الباب…)</option>
                <option value="separator">A separator line</option>
                <option value="size">Fixed length</option>
              </select>
            </label>
            {mode === "separator" && (
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-fg-muted">Separator</span>
                <input
                  className={inputCls}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                />
              </label>
            )}
            {mode === "size" && (
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-fg-muted">Chars / chapter</span>
                <input
                  type="number"
                  min={300}
                  step={100}
                  className={inputCls}
                  value={chars}
                  onChange={(e) => setChars(Number(e.target.value))}
                />
              </label>
            )}
            <button
              type="button"
              onClick={preview}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold transition hover:bg-bg-muted"
            >
              Preview chapters
            </button>
          </div>
        </div>
      </details>

      {note && <p className="text-sm font-medium text-brand">{note}</p>}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {/* Preview / edit */}
      {drafts && drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{drafts.length} chapters to add</p>
            <button
              type="button"
              onClick={() => setDrafts(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
          <ul className="space-y-2">
            {drafts.map((c, i) => (
              <li key={i} className="rounded-xl bg-white p-3 ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bg-muted text-xs font-bold text-fg-muted">
                    {i + 1}
                  </span>
                  <input
                    className="font-arabic min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-right outline-none focus:border-brand"
                    dir="rtl"
                    value={c.titleAr}
                    onChange={(e) => patch(i, { titleAr: e.target.value })}
                  />
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                    value={c.titleEn}
                    onChange={(e) => patch(i, { titleEn: e.target.value })}
                  />
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => remove(i)}
                    className="shrink-0 text-red-500 transition hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="font-arabic mt-2 line-clamp-2 px-9 text-sm text-fg-muted" dir="rtl">
                  {c.contentAr.slice(0, 160)}
                </p>
                <p className="px-9 text-[11px] text-fg-muted">
                  {c.contentAr.length.toLocaleString()} characters
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Saving…" : `Add ${drafts.length} chapters`}
          </button>
        </div>
      )}
    </div>
  );
}
