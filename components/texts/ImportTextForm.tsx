"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, FileText, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  importTextFromBrowserExtract,
  importTextFromPaste,
  importTextFromStorage,
} from "@/server/actions/texts";

type Mode = "pdf" | "paste";

const MAX_PDF_BYTES = 30 * 1024 * 1024;

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

export function ImportTextForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pdf");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<
    false | "reading" | "cleaning" | "uploading" | "preparing" | "saving"
  >(false);
  const [pageProgress, setPageProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      let result: { id: string } | { error: string };

      if (mode === "paste") {
        setBusy("saving");
        result = await importTextFromPaste(title, content);
      } else {
        if (!file) {
          setError("Choose a PDF first");
          return;
        }
        if (file.size > MAX_PDF_BYTES) {
          setError(`That PDF is ${fmtSize(file.size)} — the limit is 30 MB.`);
          return;
        }

        // Try browser-side text extraction first — for any PDF with a real
        // text layer (most digitally-exported books) this lands the whole
        // book in seconds, no upload, no chunking, no OCR cost.
        setBusy("reading");
        setPageProgress({ done: 0, total: 0 });
        const { extractPdfInBrowser } = await import("@/lib/pdf/extract-client");

        let extracted;
        try {
          extracted = await extractPdfInBrowser(file, (done, total) =>
            setPageProgress({ done, total }),
          );
        } catch (err) {
          console.error("[import] browser extract failed", err);
          extracted = {
            kind: "no-text-layer" as const,
            reason: "Couldn't read this PDF in the browser.",
          };
        }

        if (extracted.kind === "text") {
          // Server returns quickly: either persists immediately (clean text
          // layer) or queues a background Claude repair (transposed text) and
          // redirects to the reader, which streams pages in as repair lands.
          // Either way the user can close the tab.
          setBusy("saving");
          const totalPages = extracted.pages.length;
          const cleanTitle = title.trim() || file.name.replace(/\.pdf$/i, "");
          result = await importTextFromBrowserExtract(
            cleanTitle,
            extracted.pages,
            totalPages,
          );
        } else {
          // No usable text layer (likely a scan) — fall back to the existing
          // upload + Mistral-OCR pipeline.
          setBusy("uploading");
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setError("You need to be signed in to import a PDF");
            return;
          }
          const path = `${user.id}/${crypto.randomUUID()}.pdf`;
          const { error: upError } = await supabase.storage
            .from("pdf_imports")
            .upload(path, file, { contentType: "application/pdf" });
          if (upError) {
            setError(
              /bucket/i.test(upError.message)
                ? "Storage bucket missing — run db/migrations/0004_pdf_imports_bucket.sql in Supabase, then retry."
                : `Upload failed: ${upError.message}`,
            );
            return;
          }
          setBusy("preparing");
          result = await importTextFromStorage(path, title, file.name);
        }
      }

      if ("error" in result) setError(result.error);
      else router.push(`/texts/${result.id}`);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Import failed: ${err.message}`
          : "Import failed — check your connection and try again.",
      );
    } finally {
      setBusy(false);
      setPageProgress(null);
    }
  }

  const tabs = [
    { key: "pdf", label: "From a PDF", icon: <FileText className="h-4 w-4" /> },
    { key: "paste", label: "Paste text", icon: <ClipboardPaste className="h-4 w-4" /> },
  ] as const;

  const busyLabel = (() => {
    if (busy === "reading") {
      if (pageProgress && pageProgress.total > 0) {
        return `Reading PDF · ${pageProgress.done}/${pageProgress.total} pages`;
      }
      return "Reading PDF…";
    }
    if (busy === "cleaning") return "Cleaning up text…";
    if (busy === "uploading") return "Uploading for OCR…";
    if (busy === "preparing") return "Splitting into pages…";
    return "Saving…";
  })();

  return (
    <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-border">
      <h2 className="mb-1 text-lg font-bold">Import your own reading</h2>
      <p className="mb-4 text-sm text-fg-muted">
        Drop in a PDF — the text is read in your browser and lands instantly. Scanned PDFs (no
        selectable text) fall back to a slower OCR pass. Saves your position, vocabulary, and
        per-section comprehension as you go.
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
                {file ? `${file.name} · ${fmtSize(file.size)}` : "Choose a PDF from your device"}
              </span>
              <span className="mt-1 block text-xs text-fg-muted">
                Up to 30 MB. PDFs with selectable text load in seconds in the browser; scanned
                PDFs upload for OCR.
              </span>
            </label>
            {file && file.size > MAX_PDF_BYTES && (
              <p className="text-center text-sm text-danger">
                That file is {fmtSize(file.size)} — over the 30 MB limit.
              </p>
            )}
            <input
              type="text"
              placeholder="Title (optional — taken from the filename otherwise)"
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
          disabled={!!busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? busyLabel : "Import and read"}
        </button>
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </form>
      <p className="mt-3 text-center text-xs text-fg-muted">
        Imports are private to your account, for personal study. Position is saved as you read.
      </p>
    </div>
  );
}
