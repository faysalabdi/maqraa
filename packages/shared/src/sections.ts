import { paragraphs } from "./arabic";

export type Section = {
  number: number; // 0-based
  paragraphs: string[];
  wordCount: number;
};

const TARGET_WORDS = 220;
const MAX_WORDS = 380;

/**
 * Deterministically split text into reading sections of roughly TARGET_WORDS,
 * never breaking inside a paragraph. Same input always yields the same
 * sections, so stored progress stays valid.
 */
export function sectionize(contentAr: string): Section[] {
  const paras = paragraphs(contentAr);
  const sections: Section[] = [];
  let current: string[] = [];
  let words = 0;

  const push = () => {
    if (current.length > 0) {
      sections.push({ number: sections.length, paragraphs: current, wordCount: words });
      current = [];
      words = 0;
    }
  };

  for (const p of paras) {
    const w = p.split(/\s+/).filter(Boolean).length;
    if (words > 0 && (words + w > MAX_WORDS || words >= TARGET_WORDS)) push();
    current.push(p);
    words += w;
  }
  push();

  return sections.length > 0
    ? sections
    : [{ number: 0, paragraphs: [contentAr], wordCount: 0 }];
}

export function sectionText(section: Section): string {
  return section.paragraphs.join("\n\n");
}
