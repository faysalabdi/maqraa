"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, FileText, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { importTextFromPaste, importTextFromPdf } from "@/server/actions/texts";

type Mode = "pdf" | "paste";

export function ImportTextForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pdf");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let result: { id: string } | { error: string };
    if (mode === "paste") {
      result = await importTextFromPaste(title, content);
    } else {
      if (!file) {
        setError("Choose a PDF first");
        setBusy(false);
        return;
      }
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", title);
      result = await importTextFromPdf(fd);
    }

    setBusy(false);
    if ("error" in result) setError(result.error);
    else router.push(`/texts/${result.id}`);
  }

  const tabs = [
    { key: "pdf", label: "From a PDF", icon: <FileText className="h-4 w-4" /> },
    { key: "paste", label: "Paste text", icon: <ClipboardPaste className="h-4 w-4" /> },
  ] as const;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-border">
      <h2 className="mb-1 text-lg font-bold">Import your own reading</h2>
      <p className="mb-4 text-sm text-fg-muted">
        Bring a book you own as a PDF — Claude reads each page directly, so Arabic comes out in
        the right order even when the PDF was poorly encoded. Saves your position, vocabulary,
        and per-section comprehension as you go.
      </p>
      <div className="mb-4 flex gap-1 rounded-xl bg-bg-muted p-1">
        {tabs.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              setError(null);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition",
              mode === m.key ? "bg-white shadow-soft" : "text-fg-muted hover:text-fg",
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "pdf" && (
          <>
            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition hover:border-brand hover:bg-emerald-50">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <FileText className="mx-auto mb-2 h-8 w-8 text-fg-muted" />
              <span className="block text-sm font-semibold">
                {file ? file.name : "Choose a PDF from your device"}
              </span>
              <span className="mt-1 block text-xs text-fg-muted">
                Up to 20 MB and ~600 pages. Long books are read in chunks — a full book can take a few minutes.
              </span>
            </label>
            <input
              type="text"
              placeholder="Title (optional — Claude will pick one from the document)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
            />
          </>
        )}

        {mode === "paste" && (
          <>
            <input
              type="text"
              required
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
            />
            <textarea
              required
              rows={6}
              dir="rtl"
              placeholder="الصق النص العربي هنا…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-arabic w-full rounded-xl border border-border px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-brand"
            />
          </>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy
            ? mode === "pdf"
              ? "Reading the PDF with Claude… (full books can take a few minutes)"
              : "Saving…"
            : "Import and read"}
        </button>
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </form>
      <p className="mt-3 text-center text-xs text-fg-muted">
        Imports are private to your account, for personal study. Position is saved as you read.
      </p>
    </div>
  );
}
