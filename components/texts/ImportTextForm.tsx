"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, FileText, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { importTextFromPaste, importTextFromStorage } from "@/server/actions/texts";

type Mode = "pdf" | "paste";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

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
  const [busy, setBusy] = useState<false | "uploading" | "preparing" | "saving">(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // The awaits can reject (server error, network drop) — without this catch
    // the button would spin forever with no message.
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
          setError(`That PDF is ${fmtSize(file.size)} — the limit is 20 MB.`);
          return;
        }

        // Upload straight to Supabase Storage from the browser. Vercel rejects
        // request bodies over ~4.5 MB, so the file can't go through a server
        // action — the action only receives the storage path.
        setBusy("uploading");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("You need to be signed in to import a PDF");
          return;
        }

        // Storage keys must be ASCII — keep the key synthetic and pass the
        // real filename (often Arabic) separately for the title fallback.
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
    }
  }

  const tabs = [
    { key: "pdf", label: "From a PDF", icon: <FileText className="h-4 w-4" /> },
    { key: "paste", label: "Paste text", icon: <ClipboardPaste className="h-4 w-4" /> },
  ] as const;

  const busyLabel =
    busy === "uploading"
      ? "Uploading your PDF…"
      : busy === "preparing"
        ? "Splitting into pages…"
        : "Saving…";

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
                {file ? `${file.name} · ${fmtSize(file.size)}` : "Choose a PDF from your device"}
              </span>
              <span className="mt-1 block text-xs text-fg-muted">
                Up to 20 MB. Big books are read in the background — you can start reading the
                first pages while the rest loads.
              </span>
            </label>
            {file && file.size > MAX_PDF_BYTES && (
              <p className="text-center text-sm text-danger">
                That file is {fmtSize(file.size)} — over the 20 MB limit.
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
