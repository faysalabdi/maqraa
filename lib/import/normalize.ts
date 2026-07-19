/**
 * Stage 2 — normalize one extracted PDF page.
 *
 * The Python extractor already applies NFKC + tatweel stripping; this pass is
 * the single canonical implementation so text from any source (PyMuPDF, OCR,
 * a future path) lands identically. It is intentionally conservative: it only
 * repairs encoding/whitespace damage, never wording.
 *
 * Storage contract: logical-order base Unicode (U+0600 block). Never run
 * arabic-reshaper / bidi logic here — the reader renders RTL itself.
 */

// Arabic presentation forms (U+FB50–FDFF, U+FE70–FEFF) and ligatures like ﷺ
// (U+FDFA) all have compatibility decompositions, so NFKC collapses them back
// to searchable base letters. Base Arabic letters and harakat are untouched.
const TATWEEL = /ـ/g;

export function normalizePage(text: string): string {
  return (
    text
      .normalize("NFKC")
      .replace(TATWEEL, "")
      // Horizontal runs collapse to one space; paragraph breaks (blank line)
      // survive, runs of 3+ newlines collapse to a single paragraph break.
      .replace(/[ \t ]+/g, " ")
      .replace(/^ +| +$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Count base-block Arabic letters — used to sanity-check extraction output. */
export function countArabicChars(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0x0600 && cp <= 0x06ff) n++;
  }
  return n;
}
