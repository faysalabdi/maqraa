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
