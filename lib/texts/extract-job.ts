import { and, asc, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { extractArabicPdf } from "@/lib/ai/pdf-extract";
import { sectionize } from "@/lib/reading/sections";

/*
 * Background PDF extraction.
 *
 * A PDF import is split into small page-range chunks (stored in `text_chunks`)
 * and read by Claude one batch at a time. Each batch runs inside a single
 * serverless invocation that stays well under the function time limit; when a
 * batch finishes it re-triggers the extract route to process the next batch.
 * This chains across as many invocations as a book needs, so arbitrarily large
 * books never hit a single-request timeout, and the reader can render whatever
 * has been extracted so far while the rest streams in.
 */

// Small chunks keep each Claude vision call fast and — crucially — well under
// the model's output-token cap, so a chunk's Arabic is never truncated.
export const PAGES_PER_CHUNK = 12;
export const MAX_PAGES = 1000;
// Chunks read concurrently per invocation. One batch must finish inside the
// route's maxDuration; 4 small chunks comfortably do.
const BATCH_SIZE = 4;

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function appUrl(): string {
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

/** Fire-and-forget poke to the extract route to process the next batch. */
export async function triggerExtraction(textId: string): Promise<void> {
  try {
    await fetch(`${appUrl()}/api/texts/extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": internalSecret(),
      },
      body: JSON.stringify({ textId }),
    });
  } catch {
    // If we can't even reach our own route, mark the job failed so the user
    // gets a retry button instead of a job stuck in "processing" forever.
    await db
      .update(schema.userTexts)
      .set({
        extractionStatus: "failed",
        extractionError: "Could not start background extraction. Tap retry.",
      })
      .where(eq(schema.userTexts.id, textId));
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
          "Could not read any Arabic text from this PDF. It may be a scan or image-only file.",
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
 * Process one batch of pending chunks for a text, then either chain to the next
 * batch or finalize. Safe to call concurrently — chunks are claimed atomically.
 */
export async function runExtractionBatch(textId: string): Promise<void> {
  const [text] = await db
    .select()
    .from(schema.userTexts)
    .where(eq(schema.userTexts.id, textId))
    .limit(1);
  if (!text || text.extractionStatus !== "processing") return;

  const pending = await db
    .select()
    .from(schema.textChunks)
    .where(and(eq(schema.textChunks.textId, textId), eq(schema.textChunks.status, "pending")))
    .orderBy(asc(schema.textChunks.chunkIndex))
    .limit(BATCH_SIZE);

  if (pending.length === 0) {
    await finalize(textId);
    return;
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
    }),
  );

  await rebuildContent(textId);

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(schema.textChunks)
    .where(
      and(
        eq(schema.textChunks.textId, textId),
        eq(schema.textChunks.status, "pending"),
      ),
    );

  if (Number(cnt) > 0) {
    // More pages to read — chain to a fresh invocation for the next batch.
    await triggerExtraction(textId);
  } else {
    // Nothing left to claim. Any chunk still 'working' is from a crashed run;
    // it's excluded from the content and the user can recover it via retry,
    // which requeues 'working'/'failed' chunks. Finalize now rather than risk
    // an endless re-trigger loop on a stuck chunk.
    await finalize(textId);
  }
}
