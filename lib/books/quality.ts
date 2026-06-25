/**
 * Heuristics for catching low-quality uploads — specifically scanned books run
 * through an OCR-to-EPUB converter, whose Arabic comes out garbled. Pure and
 * deterministic so it can be unit-tested and run client-side before import.
 */

// OCR-to-EPUB tools (scanned PDFs) inject a per-page confidence note like
// "The text on this page is estimated to be only 39.68% accurate". Its presence
// is a near-certain sign the source is a bad scan, not clean digital text.
export const OCR_BANNER_RE =
  /^.*\btext on this page is estimated to be only\s+[\d.]+%\s+accurate.*$/gim;

/** Remove OCR confidence banners (and the blank gaps they leave) from text. */
export function stripOcrArtifacts(text: string): string {
  return text
    .replace(OCR_BANNER_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ARABIC = /[؀-ۿ]/g;
const LATIN = /[A-Za-z]/g;

export type Quality = {
  ocrBanners: number;
  arabicRatio: number; // Arabic letters / (Arabic + Latin letters)
  ok: boolean;
};

/**
 * Score a block of (expected-Arabic) book text. A book that carries OCR accuracy
 * banners, or whose letters are mostly Latin noise, is treated as a bad scan.
 */
export function assessTextQuality(text: string): Quality {
  const ocrBanners = (text.match(OCR_BANNER_RE) ?? []).length;
  const arabic = (text.match(ARABIC) ?? []).length;
  const latin = (text.match(LATIN) ?? []).length;
  const letters = arabic + latin;
  const arabicRatio = letters === 0 ? 0 : arabic / letters;
  const ok = ocrBanners === 0 && arabicRatio >= 0.85;
  return { ocrBanners, arabicRatio, ok };
}

export function assessChapters(chapters: { contentAr: string }[]): Quality {
  return assessTextQuality(chapters.map((c) => c.contentAr).join("\n"));
}
