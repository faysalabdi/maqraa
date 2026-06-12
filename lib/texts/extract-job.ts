import { and, asc, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { extractArabicPdf } from "@/lib/ai/pdf-extract";
import { sectionize } from "@/lib/reading/sections";

/*
 * Background PDF extraction.
 *
 * A PDF import is split into small page-range chunks (stored in `text_chunks`)
 * and read by Claude in batches. The extract route loops through as many
 * batches as fit inside its time budget, then hands off to a fresh invocation
 * of itself for the rest. This chains across as many invocations as a book
 * needs, so arbitrarily large books never hit a single-request timeout, and
 * the reader renders whatever has been extracted so far while the rest
 * streams in.
 *
 * The self-call URL comes from the ORIGINAL request's own headers — the one
 * URL guaranteed reachable and correct — threaded through every hop. Env-based
 * URLs (NEXT_PUBLIC_APP_URL / VERCEL_URL) are fallbacks only.
 */

// Small chunks keep each Claude vision call fast and — crucially — well under
// the model's output-token cap, so a chunk's Arabic is never truncated.
export const PAGES_PER_CHUNK = 12;
export const MAX_PAGES = 1000;
// Chunks read concurrently per batch. The SDK auto-retries 429s, so a modest
// burst above the account's tokens/min tier degrades to slower, not dropped.
const BATCH_SIZE = 5;
// Stop starting new batches this long after the invocation began and hand off
// instead. Must leave room for one worst-case batch inside maxDuration = 300s.
const LOOP_BUDGET_MS = 210_000;

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function appUrl(origin?: string): string {
  if (origin) return origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Shared secret for the internal extract route. Falls back to the service-role
 * key (always present) so background extraction works with zero extra config.
 */
export function internalSecret(): string {
  return (
    process.env.INTERNAL_TASK_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "dev-internal-secret"
  );
}

async function markFailed(textId: string, detail: string): Promise<void> {
  await db
    .update(schema.userTexts)
    .set({
      extractionStatus: "failed",
      extractionError: `Background extraction stopped (${detail}). Tap retry to resume — progress is kept.`,
    })
    .where(eq(schema.userTexts.id, textId));
}

/** Poke the extract route to continue processing in a fresh invocation. */
export async function triggerExtraction(textId: string, origin?: string): Promise<void> {
  try {
    const res = await fetch(`${appUrl(origin)}/api/texts/extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": internalSecret(),
      },
      body: JSON.stringify({ textId, origin }),
    });
    if (!res.ok) {
      // 401 = deployment protection in the way; 404 = stale deploy; etc.
      await markFailed(textId, `handoff rejected: HTTP ${res.status}`);
    }
  } catch (e) {
    // Surface the real network error so failures are diagnosable from the UI.
    const detail = e instanceof Error && e.message ? e.message.slice(0, 120) : "handoff failed";
    await markFailed(textId, detail);
  }
}

/** Rebuild user_texts.content_ar from completed chunks, in page order. */
async function rebuildContent(textId: string): Promise<void> {
  const chunks = await db
    .select()
    .from(schema.textChunks)
    .where(eq(schema.textChunks.textId, textId))
    .orderBy(asc(schema.textChunks.chunkIndex));

  const content = chunks
    .filter((c) => c.status === "done" && c.contentAr)
    .map((c) => (c.contentAr ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const settledPages = chunks
    .filter((c) => c.status === "done" || c.status === "failed")
    .reduce((sum, c) => sum + (c.pageEnd - c.pageStart), 0);

  const sections = content ? sectionize(content) : [];

  await db
    .update(schema.userTexts)
    .set({
      contentAr: content,
      wordCount: countWords(content),
      totalSections: Math.max(1, sections.length),
      pagesDone: settledPages,
    })
    .where(eq(schema.userTexts.id, textId));
}

async function finalize(textId: string): Promise<void> {
  const chunks = await db
    .select()
    .from(schema.textChunks)
    .where(eq(schema.textChunks.textId, textId))
    .orderBy(asc(schema.textChunks.chunkIndex));

  const done = chunks.filter((c) => c.status === "done" && c.contentAr);

  if (done.length === 0) {
    await db
      .update(schema.userTexts)
      .set({
        extractionStatus: "failed",
        extractionError:
          "Could not read any Arabic text from this PDF. Try re-saving it with a PDF viewer (\"Print to PDF\") and importing again.",
      })
      .where(eq(schema.userTexts.id, textId));
    return;
  }

  await rebuildContent(textId);

  await db
    .update(schema.userTexts)
    .set({ extractionStatus: "ready", extractionError: null })
    .where(eq(schema.userTexts.id, textId));

  // Free the (large) per-chunk PDF bytes now that the book is fully read.
  await db.delete(schema.textChunks).where(eq(schema.textChunks.textId, textId));
}

/**
 * Process one batch of pending chunks. Returns "stop" when there's nothing
 * more for this invocation to do (job gone, finalized, or another worker owns
 * the remaining chunks), otherwise the number of chunks still pending.
 * Safe to call concurrently — chunks are claimed atomically.
 */
async function processOneBatch(textId: string): Promise<"stop" | number> {
  const [text] = await db
    .select()
    .from(schema.userTexts)
    .where(eq(schema.userTexts.id, textId))
    .limit(1);
  if (!text || text.extractionStatus !== "processing") return "stop";

  const pending = await db
    .select()
    .from(schema.textChunks)
    .where(and(eq(schema.textChunks.textId, textId), eq(schema.textChunks.status, "pending")))
    .orderBy(asc(schema.textChunks.chunkIndex))
    .limit(BATCH_SIZE);

  if (pending.length === 0) {
    // Nothing left to claim. Any chunk still 'working' is from a crashed run;
    // it's excluded from the content and the user can recover it via retry,
    // which requeues 'working'/'failed' chunks. Finalize now rather than risk
    // an endless loop on a stuck chunk.
    await finalize(textId);
    return "stop";
  }

  // Claim each chunk atomically so a duplicate invocation can't double-read it.
  const claimed: typeof pending = [];
  for (const c of pending) {
    const res = await db
      .update(schema.textChunks)
      .set({ status: "working" })
      .where(and(eq(schema.textChunks.id, c.id), eq(schema.textChunks.status, "pending")))
      .returning({ id: schema.textChunks.id });
    if (res.length > 0) claimed.push(c);
  }
  // Another invocation got there first — let it drive.
  if (claimed.length === 0) return "stop";

  await Promise.all(
    claimed.map(async (chunk) => {
      try {
        const bytes = new Uint8Array(Buffer.from(chunk.pdfBase64, "base64"));
        const extracted = await extractArabicPdf(bytes);
        await db
          .update(schema.textChunks)
          .set({
            status: "done",
            contentAr: extracted.content_ar.trim(),
            titleAr: extracted.title_ar ?? null,
          })
          .where(eq(schema.textChunks.id, chunk.id));
      } catch {
        await db
          .update(schema.textChunks)
          .set({ status: "failed" })
          .where(eq(schema.textChunks.id, chunk.id));
      }
      // Surface progress the moment each chunk lands — a vision read of 12
      // dense pages takes minutes, and per-batch updates look like a hang.
      try {
        await rebuildContent(textId);
      } catch {
        // next chunk or the post-batch rebuild will catch the state up
      }
    }),
  );

  await rebuildContent(textId);

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(schema.textChunks)
    .where(
      and(eq(schema.textChunks.textId, textId), eq(schema.textChunks.status, "pending")),
    );

  if (Number(cnt) === 0) {
    await finalize(textId);
    return "stop";
  }
  return Number(cnt);
}

/**
 * Drive extraction for as long as this invocation's time budget allows, then
 * hand the remainder to a fresh invocation via the extract route. `origin` is
 * the public URL of the original request, threaded through every hop so the
 * self-call never depends on env configuration.
 */
export async function runExtractionLoop(textId: string, origin?: string): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    let result: "stop" | number;
    try {
      result = await processOneBatch(textId);
    } catch (e) {
      const detail = e instanceof Error && e.message ? e.message.slice(0, 120) : "batch crashed";
      console.error("[extract] batch failed", textId, e);
      await markFailed(textId, detail);
      return;
    }
    if (result === "stop") return;
    if (Date.now() - startedAt > LOOP_BUDGET_MS) {
      await triggerExtraction(textId, origin);
      return;
    }
  }
}
