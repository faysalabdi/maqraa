import { describe, expect, it } from "vitest";
import { splitIntoChapters } from "./split";

describe("splitIntoChapters", () => {
  it("splits on a separator line and lifts a short first line as the title", () => {
    const text = ["الحديث الأول", "متن الحديث هنا.", "---", "الحديث الثاني", "متن آخر."].join("\n");
    const chapters = splitIntoChapters(text, { mode: "separator", separator: "---" });
    expect(chapters).toHaveLength(2);
    expect(chapters[0].titleAr).toBe("الحديث الأول");
    expect(chapters[0].contentAr).toBe("متن الحديث هنا.");
    expect(chapters[1].titleAr).toBe("الحديث الثاني");
  });

  it("starts a new chapter at each Arabic heading word", () => {
    const text = [
      "المقدمة",
      "كلام تمهيدي.",
      "الفصل الأول: البداية",
      "نص الفصل الأول.",
      "الفصل الثاني: النهاية",
      "نص الفصل الثاني.",
    ].join("\n");
    const chapters = splitIntoChapters(text, { mode: "heading" });
    expect(chapters).toHaveLength(3);
    expect(chapters[0].titleAr).toBe("المقدمة");
    expect(chapters[1].titleAr).toBe("الفصل الأول: البداية");
    expect(chapters[2].titleAr).toBe("الفصل الثاني: النهاية");
    expect(chapters[2].contentAr).toBe("نص الفصل الثاني.");
  });

  it("packs paragraphs into size-bounded chapters with default titles", () => {
    const para = "جملة طويلة. ".repeat(40).trim();
    const text = [para, para, para].join("\n\n");
    const chapters = splitIntoChapters(text, { mode: "size", charsPerChapter: 400 });
    expect(chapters.length).toBeGreaterThan(1);
    expect(chapters[0].titleAr).toBe("الفصل 1");
  });

  it("returns nothing for empty input", () => {
    expect(splitIntoChapters("   \n  ", { mode: "heading" })).toEqual([]);
  });

  it("falls back to a default title when the first line is a full sentence", () => {
    const text = "هذه جملة كاملة تنتهي بنقطة.\nبقية النص.";
    const [chapter] = splitIntoChapters(text, { mode: "separator", separator: "@@@" });
    expect(chapter.titleAr).toBe("الفصل 1");
    expect(chapter.contentAr).toContain("هذه جملة كاملة");
  });
});
