import { and, asc, count, eq, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  extractArabicPdf,
  MissingMistralKeyError,
  ocrPdfPageRange,
  repairArabicTextChunk,
} from "@/lib/ai/pdf-extract";
import { sectionize } from "@/lib/reading/sections";

/** Sentinel persisted in user_texts.extraction_error so the UI can render a
 * tailored panel instead of a raw error message. */
export const OCR_KEY_MISSING_ERROR = "ocr-key-missing";

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

// Chunks are read by Mistral OCR or the PDF's own text layer (see
// lib/ai/pdf-extract.ts) — both run at tens of pages per second, so larger
// chunks cut wall time and DB row count without crowding the function budget.
// 50 pages keeps each chunk's base64 payload comfortably small (~10-15 MB).
export const PAGES_PER_CHUNK = 50;
export const MAX_PAGES = 2000;
// Modest concurrency keeps us under per-account OCR rate limits.
const BATCH_SIZE = 3;
// A chunk that keeps failing is requeued up to this many job-level passes
// before being marked terminally failed.
const MAX_CHUNK_ATTEMPTS = 5;
// A 'working' chunk older than this was stranded by a killed invocation and is
// safe to requeue. Must exceed the worst-case batch duration (per-chunk
// timeout + overhead) so live workers aren't falsely requeued.
export const STALE_WORKING_MS = 180_000;

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

/**
 * Poke the extract route to continue processing in a fresh invocation.
 *
 * Transient failures here must NOT fail the job: the text stays "processing"
 * and the reader page's revive check re-kicks any chain with unclaimed work
 * within a minute of being viewed. Flipping to "failed" on a blipped handoff
 * is what made extractions "randomly stop" — failed status also turns off the
 * reader's polling and self-heal, so a recoverable stall needed manual help.
 */
export async function triggerExtraction(textId: string, origin?: string): Promise<void> {
  const url = `${appUrl(origin)}/api/texts/extract`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": internalSecret(),
        },
        body: JSON.stringify({ textId, origin }),
      });
      if (res.ok) return;
      console.error(`[extract] handoff HTTP ${res.status} for ${textId} (attempt ${attempt + 1})`);
    } catch (e) {
      console.error(`[extract] handoff error for ${textId} (attempt ${attempt + 1})`, e);
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  // All attempts failed — leave status as-is; the revive check recovers it.
}

/** Rebuild user_texts.content_ar from extracted chunks, in page order. */
async function rebuildContent(textId: string): Promise<void> {
  const chunks = await db
    .select()
    .from(schema.textChunks)
    .where(eq(schema.textChunks.textId, textId))
    .orderBy(asc(schema.textChunks.chunkIndex));

  // Include any chunk that has extracted text, even if status was reverted to
  // 'pending' (Retry resets status but keeps content_ar). Otherwise a Retry on
  // a partially-extracted book would wipe content_ar back to 0 words until
  // every chunk re-extracts.
  const content = chunks
    .filter((c) => c.contentAr && c.contentAr.trim().length > 0)
    .map((c) => c.contentAr!.trim())
    .join("\n\n");

  // Count only pages whose text is actually in the book, so the progress
  // counter reflects readable content rather than failed/queued ranges.
  const donePages = chunks
    .filter((c) => c.contentAr && c.contentAr.trim().length > 0)
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

/**
 * OCR a specific page range of the preserved source PDF and return it as the
 * chunk's extracted content. Used when pdf-lib produced an empty slice at
 * import time. Throws if the source path is missing (text wasn't imported
 * with migration 0006 applied) so the chunk goes through normal retry.
 */
async function ocrFromSource(
  textId: string,
  pageStart: number,
  pageEnd: number,
): Promise<{ content_ar: string; title_ar: string | null }> {
  const [row] = await db
    .select({ pdfStoragePath: schema.userTexts.pdfStoragePath })
    .from(schema.userTexts)
    .where(eq(schema.userTexts.id, textId))
    .limit(1);
  const path = row?.pdfStoragePath;
  if (!path) {
    throw new Error(
      `chunk has empty bytes and no source PDF preserved (pages ${pageStart}-${pageEnd}); re-import the PDF`,
    );
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("pdf_imports").download(path);
  if (error || !data) {
    throw new Error(`source PDF unreadable from storage: ${error?.message ?? "no data"}`);
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  const extracted = await ocrPdfPageRange(bytes, pageStart, pageEnd);
  return { content_ar: extracted.content_ar, title_ar: extracted.title_ar ?? null };
}

/** Delete the preserved source upload — called on the success/cleanup path. */
async function deleteSourcePdf(textId: string): Promise<void> {
  const [row] = await db
    .select({ pdfStoragePath: schema.userTexts.pdfStoragePath })
    .from(schema.userTexts)
    .where(eq(schema.userTexts.id, textId))
    .limit(1);
  const path = row?.pdfStoragePath;
  if (!path) return;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin.storage.from("pdf_imports").remove([path]);
  } catch (e) {
    console.error("[extract] failed to delete source pdf", textId, e);
  }
  await db
    .update(schema.userTexts)
    .set({ pdfStoragePath: null })
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

  // The chunk catch stashes the most recent real exception here while the
  // text is still processing — fold it into the user-facing failure message
  // so a broken book says WHY instead of just "couldn't be read".
  const [textRow] = await db
    .select({ extractionError: schema.userTexts.extractionError })
    .from(schema.userTexts)
    .where(eq(schema.userTexts.id, textId))
    .limit(1);
  const lastError = textRow?.extractionError;
  const detail = lastError ? ` (${lastError})` : "";

  await rebuildContent(textId);

  if (done.length === 0) {
    await db
      .update(schema.userTexts)
      .set({
        extractionStatus: "failed",
        extractionError: `Could not read any Arabic text from this PDF.${detail}`,
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
        extractionError: `${failed.length} page range${failed.length === 1 ? "" : "s"} couldn't be read after several tries. Tap retry — what's read so far is kept.${detail}`,
      })
      .where(eq(schema.userTexts.id, textId));
    return;
  }

  // Every chunk succeeded — the book is fully read.
  await db
    .update(schema.userTexts)
    .set({ extractionStatus: "ready", extractionError: null })
    .where(eq(schema.userTexts.id, textId));

  // Free the (large) per-chunk PDF bytes and the preserved source upload now
  // that the book is fully read.
  await db.delete(schema.textChunks).where(eq(schema.textChunks.textId, textId));
  await deleteSourcePdf(textId);
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
        // Three possible shapes for an empty PDF payload:
        //  - contentAr already populated → browser-extracted text awaiting
        //    Claude transposed-ligature repair (no OCR).
        //  - contentAr empty → pdf-lib couldn't slice the range; OCR from the
        //    preserved source upload.
        //  - bytes present → normal PDF chunk path.
        let extractedContent: string;
        let extractedTitle: string | null = null;
        if (bytes.length < 500) {
          if (chunk.contentAr && chunk.contentAr.trim().length > 0) {
            extractedContent = await repairArabicTextChunk(chunk.contentAr);
          } else {
            const ocr = await ocrFromSource(textId, chunk.pageStart, chunk.pageEnd);
            extractedContent = ocr.content_ar;
            extractedTitle = ocr.title_ar ?? null;
          }
        } else {
          const ex = await extractArabicPdf(bytes);
          extractedContent = ex.content_ar;
          extractedTitle = ex.title_ar ?? null;
        }
        const extracted = { content_ar: extractedContent, title_ar: extractedTitle };
        await db
          .update(schema.textChunks)
          .set({
            status: "done",
            contentAr: extracted.content_ar.trim(),
            titleAr: extracted.title_ar ?? null,
          })
          .where(eq(schema.textChunks.id, chunk.id));
      } catch (e) {
        // Missing OCR key isn't transient — only the operator can fix it. Fail
        // the whole text now with a sentinel the UI knows how to render,
        // instead of burning 5 attempts × N chunks on a config problem.
        if (e instanceof MissingMistralKeyError) {
          await db
            .update(schema.userTexts)
            .set({ extractionStatus: "failed", extractionError: OCR_KEY_MISSING_ERROR })
            .where(eq(schema.userTexts.id, textId));
          await db
            .update(schema.textChunks)
            .set({ status: "failed" })
            .where(eq(schema.textChunks.id, chunk.id));
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[extract] chunk ${chunk.chunkIndex} (pages ${chunk.pageStart}-${chunk.pageEnd}) failed for ${textId}:`,
          e,
        );
        // Stash the real error on the text row (status stays "processing", so
        // nothing user-visible yet). If the job ends up failing, finalize folds
        // this into the failure message — no more guessing from a blank card.
        try {
          await db
            .update(schema.userTexts)
            .set({ extractionError: msg.slice(0, 280) })
            .where(eq(schema.userTexts.id, textId));
        } catch {
          // never let diagnostics take down the requeue below
        }
        // Requeue transient failures up to MAX_CHUNK_ATTEMPTS so a rate limit
        // or timeout doesn't permanently drop a page range.
        const attempts = (chunk.attempts ?? 0) + 1;
        await db
          .update(schema.textChunks)
          .set({ status: attempts >= MAX_CHUNK_ATTEMPTS ? "failed" : "pending", attempts })
          .where(eq(schema.textChunks.id, chunk.id));
      }
      // Surface progress the moment each chunk lands so the reader fills in
      // continuously rather than in batch-sized jumps.
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
 * invocation via the extract route. One batch per invocation keeps every
 * chunk's API call comfortably inside the 300s function budget, with no risk
 * of a slow chunk being killed mid-write. `origin` is the public URL of the
 * original request, threaded through every hop so the self-call never depends
 * on env configuration.
 */
export async function runExtractionLoop(textId: string, origin?: string): Promise<void> {
  let result: "stop" | number;
  try {
    result = await processOneBatch(textId);
  } catch (e) {
    // Transient (usually a DB hiccup): leave the text "processing" — any
    // claimed chunks go stale and the revive check re-kicks the chain. Only
    // finalize() may declare a text failed, and only for chunks that exhausted
    // their attempts.
    console.error("[extract] batch crashed", textId, e);
    return;
  }
  if (result !== "stop") {
    await triggerExtraction(textId, origin);
  }
}
