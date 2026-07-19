import { describe, it, expect } from "vitest";
import { normalizePage, countArabicChars } from "./normalize";

describe("normalizePage", () => {
  it("collapses Arabic presentation forms to base letters via NFKC", () => {
    // ﷲ (U+FDF2, Arabic ligature Allah) decomposes to the base letters الله.
    expect(normalizePage("ﷲ")).toBe("الله");
  });

  it("expands U+FDFA honorifics into searchable base text", () => {
    expect(normalizePage("قال ﷺ:")).toBe("قال صلى الله عليه وسلم:");
  });

  it("strips tatweel (kashida)", () => {
    expect(normalizePage("مســـاء الخير")).toBe("مساء الخير");
  });

  it("collapses horizontal whitespace but keeps paragraph breaks", () => {
    expect(normalizePage("أهلا   بالعالم\n\n\n\nفقرة ثانية")).toBe("أهلا بالعالم\n\nفقرة ثانية");
  });

  it("trims line edges and the whole page", () => {
    expect(normalizePage("  سطر أول  \n  سطر ثان  ")).toBe("سطر أول\nسطر ثان");
  });

  it("preserves existing tashkeel", () => {
    expect(normalizePage("بِسْمِ اللَّهِ")).toBe("بِسْمِ اللَّهِ");
  });
});

describe("countArabicChars", () => {
  it("counts only U+0600–U+06FF codepoints", () => {
    expect(countArabicChars("abc كتاب 123")).toBe(4);
    expect(countArabicChars("")).toBe(0);
  });
});
