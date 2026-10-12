/**
 * Grouping saved words into root families.
 *
 * Arabic words are built by casting a (usually triliteral) root into a
 * pattern: ك-ت-ب gives كِتَاب a book, كَاتِب a writer, مَكْتَب a desk, مَكْتَبَة a
 * library. A learner who has met four of those as four unrelated vocabulary
 * items has done four times the work for one piece of knowledge.
 *
 * This is deliberately pure: the two clients render the same families, and the
 * grouping has to be identical on both.
 */

export type RootWord = {
  id: string;
  lemma_ar: string;
  gloss_en: string;
  /** Morphological pattern (wazn), when it is known. */
  pattern: string | null;
};

export type RootFamily = {
  /** Root letters, space-separated, e.g. "ك ت ب". */
  root: string;
  words: RootWord[];
};

/** A family is only interesting once it shows a relationship. */
export const MIN_FAMILY = 2;

/**
 * Group words by root, biggest family first.
 *
 * Words whose root is unknown are dropped rather than lumped together: a
 * bucket of unrelated words under "unknown" teaches the wrong thing.
 */
export function groupByRoot(
  words: RootWord[],
  rootOf: (word: RootWord) => string | null,
): RootFamily[] {
  const families = new Map<string, RootWord[]>();
  for (const word of words) {
    const root = rootOf(word)?.trim();
    if (!root) continue;
    const list = families.get(root);
    if (list) list.push(word);
    else families.set(root, [word]);
  }
  return [...families.entries()]
    .map(([root, list]) => ({ root, words: dedupe(list) }))
    .sort((a, b) => b.words.length - a.words.length || a.root.localeCompare(b.root));
}

/** The same lemma saved twice is one word, not a family of two. */
function dedupe(words: RootWord[]): RootWord[] {
  const seen = new Set<string>();
  const out: RootWord[] = [];
  for (const word of words) {
    if (seen.has(word.lemma_ar)) continue;
    seen.add(word.lemma_ar);
    out.push(word);
  }
  return out;
}

/** Families worth showing: those that actually demonstrate a relationship. */
export function relatedFamilies(families: RootFamily[], min = MIN_FAMILY): RootFamily[] {
  return families.filter((f) => f.words.length >= min);
}

/** How much of the reader's vocabulary is accounted for by shared roots. */
export function familyCoverage(families: RootFamily[]): {
  families: number;
  words: number;
} {
  const related = relatedFamilies(families);
  return {
    families: related.length,
    words: related.reduce((n, f) => n + f.words.length, 0),
  };
}
