import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, FALLBACK_MODEL } from "./anthropic";
import { consumeAiQuota } from "./quota";
import { runTranslate } from "./translate-core";

/** Cache key: the source text itself, hashed so the unique index stays small. */
function translationKey(paragraph: string): string {
  return createHash("sha256").update(paragraph.trim()).digest("hex");
}

/** Beyond this the reader is asking for more than a page; trim rather than bill for it. */
const MAX_PARAGRAPHS = 40;

/**
 * Translate a page of paragraphs, returning one English string per input in
 * the same order.
 *
 * The cache is global and keyed on the text, so a paragraph of a shared book
 * is translated once for every reader who will ever open it. Only the misses
 * reach Claude, and they go in a single batched call — a page of eight
 * paragraphs costs one request, not eight.
 */
export async function translateParagraphs(
  paragraphs: string[],
  userId?: string,
  email?: string | null,
): Promise<string[]> {
  const input = paragraphs.slice(0, MAX_PARAGRAPHS).map((p) => p.trim());
  if (input.length === 0) return [];

  const keys = input.map(translationKey);
  const cached = await db
    .select({ key: schema.paragraphTranslations.key, en: schema.paragraphTranslations.en })
    .from(schema.paragraphTranslations)
    .where(inArray(schema.paragraphTranslations.key, [...new Set(keys)]));
  const byKey = new Map(cached.map((row) => [row.key, row.en]));

  // Distinct misses only: a paragraph repeated on the page is translated once.
  const missing = [...new Set(keys.filter((k) => !byKey.has(k)))];
  if (missing.length > 0) {
    // One page of translation is one unit of quota, however many paragraphs
    // missed — otherwise opening a dense page would burn a day's allowance.
    if (userId) await consumeAiQuota(userId, "translate", email);

    const missIndex = new Map(keys.map((k, i) => [k, i]));
    const sources = missing.map((k) => input[missIndex.get(k)!]);
    const fresh = await runTranslate(anthropic, FALLBACK_MODEL, sources);

    const rows = missing
      .map((key, i) => ({ key, ar: sources[i], en: fresh[i] ?? "" }))
      .filter((row) => row.en.trim().length > 0);
    if (rows.length > 0) {
      await db.insert(schema.paragraphTranslations).values(rows).onConflictDoNothing();
      for (const row of rows) byKey.set(row.key, row.en);
    }
  }

  return keys.map((k) => byKey.get(k) ?? "");
}
