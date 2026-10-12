import { eq } from "drizzle-orm";
import { groupByRoot, relatedFamilies, familyCoverage, type RootFamily, type RootWord } from "@maqraa/shared";
import { db, schema } from "@/lib/db";
import { lookupKey } from "@/lib/arabic";
import { analyseMissingRoots, cachedRoots } from "@/lib/ai/roots";
import { consumeAiQuota } from "@/lib/ai/quota";
import type { CoreUser } from "./user";

export type RootsResult = {
  families: RootFamily[];
  /** Words saved but not yet placed in a family of two or more. */
  singles: number;
  coverage: { families: number; words: number };
  /** True when some words still have no analysis, so the list may grow. */
  pending: boolean;
};

/** How many un-analysed lemmas one request will pay to analyse. */
const ANALYSE_BUDGET = 60;

/**
 * The reader's saved words, grouped into root families.
 *
 * Analysis is incremental: a reader with hundreds of saved words gets the
 * families we can already build plus a batch of new analysis, rather than one
 * very slow request. `pending` tells the client there is more to come.
 */
export async function rootsCore(user: CoreUser, analyse = true): Promise<RootsResult> {
  const rows = await db
    .select({
      id: schema.vocabItems.id,
      lemmaAr: schema.vocabItems.lemmaAr,
      glossEn: schema.vocabItems.glossEn,
    })
    .from(schema.vocabItems)
    .where(eq(schema.vocabItems.userId, user.id));

  const words: RootWord[] = rows.map((r) => ({
    id: r.id,
    lemma_ar: r.lemmaAr,
    gloss_en: r.glossEn,
    pattern: null,
  }));
  if (words.length === 0) {
    return { families: [], singles: 0, coverage: { families: 0, words: 0 }, pending: false };
  }

  const lemmas = words.map((w) => w.lemma_ar);
  let analysis = await cachedRoots(lemmas);
  const unanalysed = lemmas.filter((l) => {
    const key = lookupKey(l);
    return key && !analysis.has(key);
  });

  let pending = unanalysed.length > 0;
  if (analyse && unanalysed.length > 0) {
    const batch = [...new Set(unanalysed)].slice(0, ANALYSE_BUDGET);
    // A cache miss here is a real Claude call, so meter it like any other.
    await consumeAiQuota(user.id, "lookup", user.email);
    for (const [key, value] of await analyseMissingRoots(batch)) analysis.set(key, value);
    pending = unanalysed.length > batch.length;
  }

  const withPattern = words.map((w) => {
    const found = analysis.get(lookupKey(w.lemma_ar));
    return { ...w, pattern: found?.pattern ?? null };
  });

  const all = groupByRoot(withPattern, (w) => analysis.get(lookupKey(w.lemma_ar))?.root ?? null);
  const families = relatedFamilies(all);
  const inFamilies = new Set(families.flatMap((f) => f.words.map((w) => w.id)));

  return {
    families,
    singles: withPattern.length - inFamilies.size,
    coverage: familyCoverage(all),
    pending,
  };
}
