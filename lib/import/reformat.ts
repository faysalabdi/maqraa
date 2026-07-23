/**
 * Stage 4 — Anthropic clean + chapter split, one chunk at a time.
 *
 * This is the ONLY module that talks to the model. It mirrors the project's
 * existing AI idiom (lib/ai/*): the shared Anthropic client, a model from env,
 * and structured output via a forced `submit_chapters` tool — no hand-rolled
 * JSON parsing.
 *
 * Two paths:
 *   - reformatChunks(TextChunk[])   — PDFs with a real text layer (cheap).
 *   - reformatImageChunks(ImageChunk[]) — scanned PDFs. Page images go to
 *     Claude's vision, which OCRs + cleans + chapters in one pass (no Surya).
 *
 * The client and model are injected so tests stay hermetic (no env, no network);
 * the CLI passes the shared client + `importModelFromEnv()`.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { TextChunk } from "./chunk";

export type ReformattedChapter = {
  titleAr: string;
  contentAr: string;
  startsMidChapter: boolean;
};

export type ReformattedChunk = { chapters: ReformattedChapter[] };

/** One vision chunk: a small run of rendered page images (base64 PNG). */
export type ImageChunk = {
  index: number;
  fromPage: number;
  toPage: number;
  images: { page: number; b64: string }[];
};

export type ReformatOptions = {
  /** Model id, e.g. from importModelFromEnv(). Required. */
  model: string;
  /** Anthropic client. Defaults to the shared lib/ai client (lazy-loaded). */
  client?: Anthropic;
  /** Attempts per chunk before giving up (default 3). */
  maxAttempts?: number;
  /** Max output tokens per chunk (default 16000). */
  maxTokens?: number;
  onLog?: (msg: string) => void;
  /** Sleep between retries. Defaults to real setTimeout; tests pass a no-op. */
  delayMs?: (ms: number) => Promise<void>;
  /** Book-specific steering appended to the system prompt (chapter granularity,
   *  front-matter to drop, etc.). Empty/undefined = generic behavior. */
  guidance?: string;
};

const SHARED_TASKS = `Your tasks:
1. Rejoin words that were wrongly split; separate words that were wrongly merged.
2. Restore natural paragraph breaks.
3. Fix obvious OCR/extraction corruptions, but DO NOT rewrite, translate, modernize,
   or paraphrase the author's text. Preserve wording exactly.
4. Preserve tashkeel (harakat) that is present. NEVER add diacritics that aren't there.
5. Output logical-order Unicode Arabic (base letters, U+0600 block). No presentation forms.
6. Detect chapter/section boundaries (فصل / باب / a heading line / a numbered chapter)
   and split accordingly.
7. Drop running headers, footers, and page numbers from the body text.
8. Do NOT repeat the chapter/section heading at the start of content_ar — the
   heading goes in title_ar only. If the source prints the heading again as the
   first line of the body, omit that echo.

Titles: use the section's heading text as-is when one exists. If a section has no
visible heading, give it a short descriptive Arabic title (titles are metadata; the
body text itself must remain verbatim).

Reply ONLY via the submit_chapters tool. starts_mid_chapter: true means this chunk's
FIRST block continues the previous chunk's last chapter (no new heading seen) — it may
only be true for the first chapter you return.`;

const TEXT_SYSTEM = `You are an Arabic text-cleaning and structuring assistant. Input is raw text
extracted from a PDF of an Arabic book. It may have: merged words, words split
mid-token, broken paragraph breaks, OCR errors, and page markers [[PAGE n]].
The input may begin with a section tagged [[OVERLAP ...]] … [[END OVERLAP]]: that
is the tail of the previous chunk, given only as context — NEVER include it in your
output. Remove all [[PAGE n]] markers from the body.

${SHARED_TASKS}`;

const VISION_SYSTEM = `You are an Arabic OCR and structuring assistant. Input is a run of page images
from a scanned Arabic book, in reading order. Read the Arabic text off each page,
then clean and structure it.

${SHARED_TASKS}`;

const SUBMIT_CHAPTERS = {
  name: "submit_chapters",
  description: "Submit the cleaned, chapter-split Arabic text for this chunk.",
  input_schema: {
    type: "object",
    properties: {
      chapters: {
        type: "array",
        description: "Chapters (or chapter fragments) found in this chunk, in order.",
        items: {
          type: "object",
          properties: {
            title_ar: { type: "string", description: "Arabic heading, or a short descriptive one." },
            content_ar: { type: "string", description: "Verbatim cleaned body text, logical-order Unicode." },
            starts_mid_chapter: {
              type: "boolean",
              description: "True only if the FIRST chapter continues the previous chunk's last chapter.",
            },
          },
          required: ["title_ar", "content_ar", "starts_mid_chapter"],
        },
      },
    },
    required: ["chapters"],
  },
} as const;

/** Resolve the import model from env without loading the strict env schema. */
export function importModelFromEnv(): string {
  const model = (process.env.ANTHROPIC_IMPORT_MODEL || process.env.ANTHROPIC_TEST_MODEL)?.trim();
  if (!model) {
    throw new Error("ANTHROPIC_IMPORT_MODEL (or ANTHROPIC_TEST_MODEL) is not set");
  }
  return model;
}

async function resolveClient(opts: ReformatOptions): Promise<Anthropic> {
  if (opts.client) return opts.client;
  return (await import("@/lib/ai/anthropic")).anthropic;
}

/** Coerce a submit_chapters tool input into typed chapters. Exported for tests. */
export function chaptersFromToolInput(input: unknown): ReformattedChunk {
  const chapters = (input as { chapters?: unknown })?.chapters;
  if (!Array.isArray(chapters)) throw new Error("submit_chapters returned no chapters array");
  return {
    chapters: chapters.map((c, i) => {
      const o = c as Record<string, unknown>;
      if (typeof o?.content_ar !== "string" || typeof o?.title_ar !== "string") {
        throw new Error(`chapter ${i + 1} is missing title_ar/content_ar strings`);
      }
      return {
        titleAr: o.title_ar,
        contentAr: o.content_ar,
        startsMidChapter: o.starts_mid_chapter === true,
      };
    }),
  };
}

type UserContent = Anthropic.MessageParam["content"];

async function callModel(
  system: string,
  userContent: UserContent,
  opts: ReformatOptions,
): Promise<ReformattedChunk> {
  const client = await resolveClient(opts);
  const fullSystem = opts.guidance?.trim()
    ? `${system}\n\nBOOK-SPECIFIC GUIDANCE (overrides the generic rules above where they conflict):\n${opts.guidance.trim()}`
    : system;
  const response = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 16000,
    system: [{ type: "text", text: fullSystem, cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_CHAPTERS as never],
    tool_choice: { type: "tool", name: "submit_chapters" },
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "max_tokens") {
    const err = new Error(
      "output hit max_tokens before the tool call completed — lower --pages-per-chunk",
    );
    (err as { fatal?: boolean }).fatal = true; // retrying the same input won't help
    throw err;
  }

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("model returned no submit_chapters call");
  return chaptersFromToolInput(toolUse.input);
}

function isRetryable(e: unknown): boolean {
  if ((e as { fatal?: boolean })?.fatal) return false;
  const status = (e as { status?: number })?.status;
  if (status === undefined) return true; // network / parse failure
  return status === 429 || status >= 500;
}

/** Anthropic's safety filter rejected the output for this chunk (a 400 specific
 *  to the chunk's content, not a config problem). */
function isContentFiltered(e: unknown): boolean {
  const err = e as { status?: number; message?: string };
  return err?.status === 400 && /content filtering/i.test(err?.message ?? "");
}

async function withRetry(
  label: string,
  run: () => Promise<ReformattedChunk>,
  opts: ReformatOptions,
): Promise<ReformattedChunk> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
      const retryable = isRetryable(e);
      // Surface the real network cause the SDK hides behind "Connection error."
      // (undici wraps the socket error: err.cause.cause = ECONNRESET/ENOTFOUND/…).
      const err = e as Error & {
        status?: number;
        cause?: { message?: string; code?: string; cause?: { message?: string; code?: string } };
      };
      const detail = [err.message, err.cause?.message, err.cause?.code, err.cause?.cause?.message, err.cause?.cause?.code]
        .filter(Boolean)
        .join(" <- ");
      opts.onLog?.(
        `  ${label} attempt ${attempt}/${maxAttempts} failed [${err.name}${err.status ? " " + err.status : ""}]: ${detail}` +
          `${retryable && attempt < maxAttempts ? " — retrying" : ""}`,
      );
      if (!retryable || attempt === maxAttempts) break;
      const status = (e as { status?: number })?.status;
      const wait = status === 429 ? 15000 * attempt : 2000 * attempt * attempt;
      const sleep = opts.delayMs ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
      await sleep(wait);
    }
  }
  // A content-filter block is specific to this chunk's text — don't let one
  // flagged section abort the whole book. Emit a visible placeholder chapter so
  // the pages aren't lost silently and an admin can re-enter them, then continue.
  if (isContentFiltered(lastErr)) {
    opts.onLog?.(`  ${label}: blocked by the AI content filter — inserting a placeholder, continuing`);
    return {
      chapters: [
        {
          titleAr: "⚠ مقطع محظور أثناء الاستيراد — يحتاج إدخالاً يدوياً",
          contentAr: `[This section (${label}) was blocked by the AI content filter during import and needs to be entered manually via the admin book editor.]`,
          startsMidChapter: false,
        },
      ],
    };
  }
  throw lastErr;
}

export function reformatTextChunk(chunk: TextChunk, opts: ReformatOptions): Promise<ReformattedChunk> {
  return withRetry(`chunk ${chunk.index + 1}`, () => callModel(TEXT_SYSTEM, chunk.text, opts), opts);
}

export function reformatImageChunk(chunk: ImageChunk, opts: ReformatOptions): Promise<ReformattedChunk> {
  const content: UserContent = [
    { type: "text", text: `Pages ${chunk.fromPage}–${chunk.toPage}, in reading order:` },
    ...chunk.images.map(
      (img) =>
        ({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: img.b64 },
        }) as const,
    ),
  ];
  return withRetry(`chunk ${chunk.index + 1}`, () => callModel(VISION_SYSTEM, content, opts), opts);
}

/** Run items through the model with bounded concurrency, preserving input order. */
async function mapConcurrent<T>(
  items: T[],
  worker: (item: T, i: number) => Promise<ReformattedChunk>,
  concurrency: number,
): Promise<ReformattedChunk[]> {
  const results = new Array<ReformattedChunk>(items.length);
  let next = 0;
  async function run() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, run),
  );
  return results;
}

export function reformatChunks(
  chunks: TextChunk[],
  opts: ReformatOptions,
  concurrency = 3,
): Promise<ReformattedChunk[]> {
  return mapConcurrent(
    chunks,
    async (chunk, i) => {
      const started = Date.now();
      const out = await reformatTextChunk(chunk, opts);
      opts.onLog?.(
        `  chunk ${i + 1}/${chunks.length} (pages ${chunk.fromPage}–${chunk.toPage}): ` +
          `${out.chapters.length} block(s), ${((Date.now() - started) / 1000).toFixed(0)}s`,
      );
      return out;
    },
    concurrency,
  );
}

export function reformatImageChunks(
  chunks: ImageChunk[],
  opts: ReformatOptions,
  concurrency = 3,
): Promise<ReformattedChunk[]> {
  return mapConcurrent(
    chunks,
    async (chunk, i) => {
      const started = Date.now();
      const out = await reformatImageChunk(chunk, opts);
      opts.onLog?.(
        `  chunk ${i + 1}/${chunks.length} (pages ${chunk.fromPage}–${chunk.toPage}, vision): ` +
          `${out.chapters.length} block(s), ${((Date.now() - started) / 1000).toFixed(0)}s`,
      );
      return out;
    },
    concurrency,
  );
}
