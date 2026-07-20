"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookUp, Check, ExternalLink, FileUp, Loader2 } from "lucide-react";
import type { PdfImportStatus } from "@maqraa/shared";
import { slugify } from "@/lib/utils";
import { TIERS, tierFor, type Tier } from "@/components/book/BookCover";

// Same tier→level mapping as the EPUB uploader.
const TIER_LEVEL: Record<Tier, number> = { Beginner: 1, Intermediate: 3, Advanced: 5 };

const GENRES = [
  { value: "classical", label: "Classical" },
  { value: "islamic", label: "Islamic" },
  { value: "arabic_literature", label: "Arabic literature" },
  { value: "translated", label: "Translated" },
  { value: "graded_reader", label: "Graded reader" },
];

// Index matches the CLI's [n/6] stage markers; 0 = not started yet.
const STAGE_LABELS = [
  "Waiting for the runner",
  "Extracting the PDF",
  "Normalizing text",
  "Chunking pages",
  "Cleaning & chaptering with AI",
  "Stitching chapters",
  "Writing to the database",
];

const field =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
const label = "mb-1 block text-xs font-bold uppercase tracking-wider text-fg-muted";

type ActiveJob = { jobId: string; slug: string; title: string };
const LS_KEY = "pdf-import-job";

export function PdfImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState({
    titleAr: "",
    titleEn: "",
    slug: "",
    authorAr: "",
    authorEn: "",
    level: 3,
    genre: "classical",
    difficulty: 3,
    blurb: "",
    guidance: "",
    forceOcr: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ActiveJob | null>(null);
  const [status, setStatus] = useState<PdfImportStatus | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Resume tracking a job started in an earlier session.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setJob(JSON.parse(raw) as ActiveJob);
    } catch {
      localStorage.removeItem(LS_KEY);
    }
  }, []);

  // Poll until the run reaches a terminal state. Transient errors get a
  // minute of retries before we give up (the runner is the source of truth).
  useEffect(() => {
    if (!job) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    const tick = async () => {
      try {
        const res = await fetch(`/api/v1/admin/pdf-import/${job.jobId}`);
        const json = (await res.json().catch(() => null)) as PdfImportStatus | null;
        if (stopped) return;
        if (!res.ok) throw new Error(json?.error ?? `Status check failed (${res.status})`);
        failures = 0;
        setStatus(json);
        if (json?.status === "done" || json?.status === "failed") {
          localStorage.removeItem(LS_KEY);
          return;
        }
      } catch (e) {
        if (stopped) return;
        if (++failures >= 6) {
          setStatus({
            status: "failed",
            error: e instanceof Error ? e.message : "Status check failed.",
          });
          localStorage.removeItem(LS_KEY);
          return;
        }
      }
      timer = setTimeout(tick, 10_000);
    };

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job]);

  async function submit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(form)) fd.append(k, String(v));
      const res = await fetch("/api/v1/admin/pdf-import", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as
        | { jobId?: string; slug?: string; error?: string }
        | null;
      if (!res.ok || !json?.jobId || !json.slug) {
        throw new Error(json?.error ?? `Upload failed (${res.status})`);
      }
      const active: ActiveJob = {
        jobId: json.jobId,
        slug: json.slug,
        title: form.titleEn || form.titleAr,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(active));
      setStatus({ status: "queued" });
      setJob(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    setJob(null);
    setStatus(null);
    setFile(null);
    setError(null);
  }

  // ── Tracking an active / finished job ─────────────────────────────────
  if (job) {
    const terminal = status?.status === "done" || status?.status === "failed";
    const progress = status?.progress;
    const stageLabel =
      status?.status === "queued"
        ? "Queued — waiting for the runner"
        : STAGE_LABELS[progress?.stage ?? 0];
    return (
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border">
        <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">Admin · PDF import</p>
        <h2 className="mt-1 font-bold">{job.title}</h2>

        <div className="mt-3 flex items-center gap-3">
          {status?.status === "done" ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Check className="h-5 w-5" />
            </span>
          ) : status?.status === "failed" ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {status?.status === "done" ? (
              <p className="text-sm font-semibold text-brand">Imported into the catalogue.</p>
            ) : status?.status === "failed" ? (
              <p className="text-sm font-semibold text-danger">{status.error ?? "Import failed."}</p>
            ) : (
              <>
                <p className="text-sm font-semibold">{stageLabel}…</p>
                {progress?.chunkDone != null && progress.chunkTotal != null && (
                  <p className="text-xs text-fg-muted">
                    chunk {progress.chunkDone} of {progress.chunkTotal}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {!terminal && (
          <p className="mt-3 text-xs text-fg-muted">
            This takes a few minutes and runs in the cloud — you can close this page and come back.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {status?.status === "done" && (
            <Link
              href={`/book/${status.slug ?? job.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
            >
              <BookUp className="h-4 w-4" /> Open the book
            </Link>
          )}
          {status?.runUrl && (
            <a
              href={status.runUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View run logs
            </a>
          )}
          {terminal && (
            <button
              onClick={reset}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:shadow-soft"
            >
              Import another PDF
            </button>
          )}
        </div>
      </section>
    );
  }

  // ── Upload form ─────────────────────────────────────────────────────────
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border">
      <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">Admin · PDF import</p>
      <p className="mt-1 text-sm text-fg-muted">
        Import a PDF into the <span className="font-semibold">public catalogue</span> — the same
        pipeline as <code>pnpm import-pdf</code>, run in the cloud. Takes a few minutes; you can
        close the page once it starts. Max 45 MB.
      </p>

      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-bg-muted/30 px-4 py-6 text-sm font-semibold transition hover:border-brand hover:bg-brand/5"
        >
          <FileUp className="h-4 w-4 text-brand" />
          {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "Choose a .pdf file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 45 * 1024 * 1024) {
              setError("That PDF is over 45 MB — import it with the CLI instead.");
              e.target.value = "";
              return;
            }
            setError(null);
            setFile(f);
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Title (Arabic)</label>
            <input
              className={`${field} font-arabic`}
              dir="rtl"
              value={form.titleAr}
              onChange={(e) => set("titleAr", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Title (English)</label>
            <input
              className={field}
              value={form.titleEn}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, titleEn: v, slug: slugEdited ? f.slug : slugify(v) }));
              }}
            />
          </div>
          <div>
            <label className={label}>
              URL slug <span className="font-normal normal-case text-fg-muted">· /book/…</span>
            </label>
            <input
              className={field}
              value={form.slug}
              onChange={(e) => {
                setSlugEdited(true);
                set("slug", e.target.value);
              }}
            />
          </div>
          <div>
            <label className={label}>Author (Arabic, optional)</label>
            <input
              className={`${field} font-arabic`}
              dir="rtl"
              value={form.authorAr}
              onChange={(e) => set("authorAr", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Level</label>
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
              <select className={field} value={form.genre} onChange={(e) => set("genre", e.target.value)}>
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Difficulty</label>
              <select
                className={field}
                value={form.difficulty}
                onChange={(e) => set("difficulty", Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Author (English, optional)</label>
            <input className={field} value={form.authorEn} onChange={(e) => set("authorEn", e.target.value)} />
          </div>
        </div>

        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">
            Advanced options
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            <div>
              <label className={label}>Blurb (optional)</label>
              <input className={field} value={form.blurb} onChange={(e) => set("blurb", e.target.value)} />
            </div>
            <div>
              <label className={label}>Chaptering guidance (optional)</label>
              <input
                className={field}
                placeholder="e.g. each باب is a chapter; drop the translator's preface"
                value={form.guidance}
                onChange={(e) => set("guidance", e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.forceOcr}
                onChange={(e) => set("forceOcr", e.target.checked)}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              Force OCR (scanned PDF without a text layer)
            </label>
          </div>
        </details>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <button
          onClick={submit}
          disabled={!file || !form.titleAr || !form.titleEn || !form.slug || submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {submitting ? "Uploading…" : "Start the import"}
        </button>
      </div>
    </section>
  );
}
