/**
 * Stage 5 — stitch per-chunk model output into one ordered chapter list.
 *
 * The model processes page chunks independently; a chapter that straddles a
 * chunk boundary arrives as the tail of chunk N and a `starts_mid_chapter`
 * head of chunk N+1. Stitching appends such continuations instead of starting
 * a new chapter. Pure + deterministic so it can be unit-tested.
 */

import type { ReformattedChunk } from "./reformat";

export type StitchedChapter = {
  chapterNumber: number;
  titleAr: string;
  titleEn: string;
  contentAr: string;
};

/** Harakat + superscript alef + tatweel — ignored when matching a title echo. */
const DIACRITICS = /[ً-ْٰـ]/g;
const normAr = (s: string): string => s.replace(DIACRITICS, "").replace(/\s+/g, " ").trim();

/**
 * Drop a heading that the body repeats as its opening line. OCR/model output
 * often prints "الفصل الأول" as the title AND again at the top of the text.
 * Only strips an exact (diacritic/whitespace-insensitive) leading match, so a
 * numbered heading the body doesn't echo ("١ - بائع الأصنام") is left alone.
 */
export function stripLeadingTitle(titleAr: string, contentAr: string): string {
  const nt = normAr(titleAr);
  if (nt.length < 3) return contentAr;
  for (let i = 1; i <= contentAr.length; i++) {
    const prefix = normAr(contentAr.slice(0, i));
    if (prefix.length < nt.length) continue;
    if (prefix === nt) return contentAr.slice(i).replace(/^[\s\-–—:.،ـ]+/u, "").trim();
    break; // passed the title's length without a match
  }
  return contentAr;
}

export function stitchChunks(outputs: ReformattedChunk[]): StitchedChapter[] {
  const chapters: { titleAr: string; contentAr: string }[] = [];

  for (const output of outputs) {
    for (let i = 0; i < output.chapters.length; i++) {
      const ch = output.chapters[i];
      const continuesPrevious = i === 0 && ch.startsMidChapter && chapters.length > 0;
      if (continuesPrevious) {
        const prev = chapters[chapters.length - 1];
        prev.contentAr = `${prev.contentAr.trim()}\n\n${ch.contentAr.trim()}`.trim();
      } else {
        // startsMidChapter on the very first chapter of chunk 0 can't attach
        // to anything — treat it as a new chapter.
        chapters.push({ titleAr: ch.titleAr.trim(), contentAr: ch.contentAr.trim() });
      }
    }
  }

  return chapters
    .filter((c) => c.contentAr.length > 0)
    .map((c, i) => ({
      chapterNumber: i + 1,
      titleAr: c.titleAr || `الفصل ${i + 1}`,
      titleEn: `Chapter ${i + 1}`,
      contentAr: stripLeadingTitle(c.titleAr, c.contentAr),
    }));
}

/**
 * Guardrail checks on stitched chapters. Empty chapters are dropped by
 * stitchChunks; anything suspicious here is kept but returned as a warning
 * for manual review (logged by the CLI).
 */
export function validateChapters(chapters: StitchedChapter[]): string[] {
  const warnings: string[] = [];
  for (const c of chapters) {
    if (c.contentAr.length < c.titleAr.length) {
      warnings.push(
        `chapter ${c.chapterNumber} ("${c.titleAr}"): content (${c.contentAr.length} chars) ` +
          `is shorter than its heading — likely a mis-split`,
      );
    } else if (c.contentAr.length < 200) {
      warnings.push(
        `chapter ${c.chapterNumber} ("${c.titleAr}"): only ${c.contentAr.length} chars — ` +
          `check it's real body text, not a stray heading`,
      );
    }
  }
  return warnings;
}
