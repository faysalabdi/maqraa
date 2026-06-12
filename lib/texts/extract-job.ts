import { and, asc, count, eq, inArray, lt } from "drizzle-orm";
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

// Small chunks keep each Claude vision call short and — crucially — well under
// the model's output-token cap, so a chunk's Arabic is never truncated. Dense
// scanned pages read at roughly 10-20s/page, so 6 pages stays comfortably
// inside the 240s per-chunk timeout.
export const PAGES_PER_CHUNK = 6;
export const MAX_PAGES = 1000;
// Modest concurrency keeps us under the account's tokens/min tier so chunks
// rarely hit a rate limit in the first place.
const BATCH_SIZE = 3;
// A chunk that keeps failing is requeued up to this many job-level passes
// before being marked terminally failed.
const MAX_CHUNK_ATTEMPTS = 5;
// A 'working' chunk older than this was stranded by a killed invocation and is
// safe to requeue. Must exceed the worst-case batch duration (240s chunk
// timeout + overhead) or live workers get falsely requeued.
export const STALE_WORKING_MS = 360_000;

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

  // Count only pages whose text is actually in the book, so the progress
  // counter reflects readable content rather than failed/queued ranges.
  const donePages = chunks
    .filter((c) => c.status === "done")
    .reduce((sum, c) => sum + (c.pageEnd - c.pageStart), 0);

  const sections = content ? sectionize(content) : [];

  await db
    .update(schema.userTexts)
    .set({
      contentAr: content,
      wordCount: countWords(content),
      totalSections: Math.max(1, sections.length),
      pagesDone: donePages,
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
  const failed = chunks.filter((c) => c.status === "failed");

  await rebuildContent(textId);

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

  if (failed.length > 0) {
    // Some page ranges never read after all retries. Keep the chunks (so the
    // user can resume and re-attempt just those) and surface a failed state
    // rather than silently passing off a partial book as complete.
    await db
      .update(schema.userTexts)
      .set({
        extractionStatus: "failed",
        extractionError: `${failed.length} page range${failed.length === 1 ? "" : "s"} couldn't be read after several tries. Tap retry to attempt them again — what's read so far is kept.`,
      })
      .where(eq(schema.userTexts.id, textId));
    return;
  }

  // Every chunk succeeded — the book is fully read.
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

  // Recover chunks stranded in 'working' by a killed invocation.
  const staleBefore = new Date(Date.now() - STALE_WORKING_MS);
  await db
    .update(schema.textChunks)
    .set({ status: "pending" })
    .where(
      and(
        eq(schema.textChunks.textId, textId),
        eq(schema.textChunks.status, "working"),
        lt(schema.textChunks.claimedAt, staleBefore),
      ),
    );

  const pending = await db
    .select()
    .from(schema.textChunks)
    .where(and(eq(schema.textChunks.textId, textId), eq(schema.textChunks.status, "pending")))
    .orderBy(asc(schema.textChunks.chunkIndex))
    .limit(BATCH_SIZE);

  if (pending.length === 0) {
    // No pending work. If something is still freshly 'working' (another live
    // invocation), let it drive. Otherwise everything is done or terminally
    // failed — finalize.
    const [{ cnt: working }] = await db
      .select({ cnt: count() })
      .from(schema.textChunks)
      .where(
        and(eq(schema.textChunks.textId, textId), eq(schema.textChunks.status, "working")),
      );
    if (Number(working) === 0) await finalize(textId);
    return "stop";
  }

  // Claim each chunk atomically so a duplicate invocation can't double-read it.
  const now = new Date();
  const claimed: typeof pending = [];
  for (const c of pending) {
    const res = await db
      .update(schema.textChunks)
      .set({ status: "working", claimedAt: now })
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
        // Requeue transient failures up to MAX_CHUNK_ATTEMPTS so a rate limit
        // or timeout doesn't permanently drop a page range.
        const attempts = (chunk.attempts ?? 0) + 1;
        await db
          .update(schema.textChunks)
          .set({ status: attempts >= MAX_CHUNK_ATTEMPTS ? "failed" : "pending", attempts })
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

  // Count work that still needs doing (pending now includes requeued failures).
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(schema.textChunks)
    .where(
      and(
        eq(schema.textChunks.textId, textId),
        inArray(schema.textChunks.status, ["pending", "working"]),
      ),
    );

  if (Number(cnt) === 0) {
    await finalize(textId);
    return "stop";
  }
  return Number(cnt);
}

/**
 * Process exactly ONE batch, then hand any remaining work to a fresh
 * invocation via the extract route. One batch per invocation is what lets the
 * generous 240s per-chunk timeout fit the 300s function budget — the batch
 * starts immediately, never partway through an invocation's lifetime.
 * `origin` is the public URL of the original request, threaded through every
 * hop so the self-call never depends on env configuration.
 */
export async function runExtractionLoop(textId: string, origin?: string): Promise<void> {
  let result: "stop" | number;
  try {
    result = await processOneBatch(textId);
  } catch (e) {
    const detail = e instanceof Error && e.message ? e.message.slice(0, 120) : "batch crashed";
    console.error("[extract] batch failed", textId, e);
    await markFailed(textId, detail);
    return;
  }
  if (result !== "stop") {
    await triggerExtraction(textId, origin);
  }
}
