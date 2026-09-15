const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
const PUNCTUATION = /[،؛؟.,;:!?"'()\[\]«»…ـ-]/g;

export function stripDiacritics(s: string): string {
  return s.replace(DIACRITICS, "");
}

export function cleanWord(s: string): string {
  return stripDiacritics(s).replace(PUNCTUATION, "").trim();
}

export function lookupKey(surface: string): string {
  return cleanWord(surface);
}

/**
 * Cache key for a word lookup. Unlike `lookupKey`/`cleanWord`, this KEEPS the
 * diacritics (only punctuation/whitespace stripped), so homographs that differ
 * only by vocalization — عَلَم (flag) vs عِلْم (knowledge) — cache separately
 * instead of the first sense winning for all of them.
 */
export function vocalizedKey(surface: string): string {
  return surface.replace(PUNCTUATION, "").trim();
}

/** Orthographic variants readers do not distinguish when recognising a word. */
function foldLetters(s: string): string {
  return s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه");
}

/**
 * Definite-article forms only, longest first.
 *
 * Bare one-letter clitics (و ف ب ك ل) are deliberately absent: far too many
 * ordinary words simply begin with those letters, so stripping them turns
 * كتاب into تاب. A saved word failing to light up is a small annoyance; the
 * wrong word lighting up is a lie about what the reader knows.
 */
const PROCLITICS = ["وال", "فال", "بال", "كال", "لل", "ال"];

/** Below this, stripping a prefix is as likely to destroy the word as reveal it. */
const MIN_STEM = 3;

/**
 * Key for deciding whether a word in the text is one the reader already saved.
 *
 * Deliberately looser than `lookupKey`, which keys the lookup cache and must
 * not collapse distinct words. Here the cost of a miss is a saved word not
 * showing as saved — which is what readers actually notice — so this also
 * folds orthographic variants and strips the clitics Arabic glues onto the
 * front of a word. Saving وَالْكِتَابُ and later meeting الكتاب should match.
 */
export function matchKey(surface: string): string {
  const base = foldLetters(cleanWord(surface));
  for (const prefix of PROCLITICS) {
    if (base.startsWith(prefix) && base.length - prefix.length >= MIN_STEM) {
      return base.slice(prefix.length);
    }
  }
  return base;
}

export function isArabicWord(s: string): boolean {
  return /[؀-ۿ]/.test(cleanWord(s));
}

export function tokenizeParagraph(p: string): string[] {
  return p.split(/\s+/).filter(Boolean);
}

export function paragraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
