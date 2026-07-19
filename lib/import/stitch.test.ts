import { describe, it, expect } from "vitest";
import { stitchChunks, validateChapters, stripLeadingTitle } from "./stitch";
import type { ReformattedChunk } from "./reformat";

const out = (
  chapters: { title: string; content: string; mid?: boolean }[],
): ReformattedChunk => ({
  chapters: chapters.map((c) => ({
    titleAr: c.title,
    contentAr: c.content,
    startsMidChapter: c.mid === true,
  })),
});

describe("stripLeadingTitle", () => {
  it("drops a body that opens by echoing its heading", () => {
    expect(stripLeadingTitle("الفصل الأول", "الفصل الأول كان جميلاً")).toBe("كان جميلاً");
  });
  it("ignores diacritics/tatweel/whitespace when matching the echo", () => {
    expect(stripLeadingTitle("الفصلُ الأوَّل", "الْفَصْلُ الأوّل\n\nكان")).toBe("كان");
  });
  it("leaves the body alone when it does not echo the heading", () => {
    expect(stripLeadingTitle("١ - بائع الأصنام", "قبل أيام كثيرة")).toBe("قبل أيام كثيرة");
  });
  it("strips a leading separator after the echo", () => {
    expect(stripLeadingTitle("مقدمة", "مقدمة: هذا كتاب")).toBe("هذا كتاب");
  });
  it("does nothing for a too-short title", () => {
    expect(stripLeadingTitle("ب", "ب ت ث")).toBe("ب ت ث");
  });
});

describe("stitchChunks", () => {
  it("numbers chapters 1..n in order", () => {
    const result = stitchChunks([
      out([
        { title: "الباب الأول", content: "نص أول ".repeat(50) },
        { title: "الباب الثاني", content: "نص ثان ".repeat(50) },
      ]),
    ]);
    expect(result.map((c) => c.chapterNumber)).toEqual([1, 2]);
    expect(result[0].titleAr).toBe("الباب الأول");
    expect(result[0].titleEn).toBe("Chapter 1");
  });

  it("appends a mid-chapter continuation to the previous chapter", () => {
    const result = stitchChunks([
      out([{ title: "الفصل الأول", content: "بداية ".repeat(60) }]),
      out([
        { title: "تابع", content: "تكملة ".repeat(60), mid: true },
        { title: "الفصل الثاني", content: "جديد ".repeat(60) },
      ]),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].titleAr).toBe("الفصل الأول");
    expect(result[0].contentAr).toContain("بداية");
    expect(result[0].contentAr).toContain("تكملة");
    expect(result[1].titleAr).toBe("الفصل الثاني");
  });

  it("treats a mid flag on chunk 0's first chapter as a new chapter", () => {
    const result = stitchChunks([out([{ title: "افتتاح", content: "نص ".repeat(100), mid: true }])]);
    expect(result).toHaveLength(1);
    expect(result[0].titleAr).toBe("افتتاح");
  });

  it("only honors the mid flag on a chunk's FIRST chapter", () => {
    const result = stitchChunks([
      out([{ title: "أ", content: "س ".repeat(100) }]),
      out([
        { title: "ب", content: "ص ".repeat(100) },
        { title: "ج", content: "ع ".repeat(100), mid: true },
      ]),
    ]);
    expect(result).toHaveLength(3);
  });

  it("drops empty chapters and falls back to a numbered title", () => {
    const result = stitchChunks([
      out([
        { title: "فارغ", content: "   " },
        { title: "", content: "محتوى ".repeat(50) },
      ]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].titleAr).toBe("الفصل 1");
  });
});

describe("validateChapters", () => {
  it("warns on content shorter than its heading", () => {
    const warnings = validateChapters([
      { chapterNumber: 1, titleAr: "عنوان طويل جدا", titleEn: "Chapter 1", contentAr: "قصير" },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("shorter than its heading");
  });

  it("warns on suspiciously tiny chapters", () => {
    const warnings = validateChapters([
      { chapterNumber: 3, titleAr: "مقدمة", titleEn: "Chapter 3", contentAr: "مقدمة الكتاب" },
    ]);
    expect(warnings[0]).toContain("chapter 3");
  });

  it("accepts ordinary chapters", () => {
    expect(
      validateChapters([
        { chapterNumber: 1, titleAr: "باب", titleEn: "Chapter 1", contentAr: "نص ".repeat(200) },
      ]),
    ).toEqual([]);
  });
});
