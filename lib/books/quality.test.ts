import { describe, expect, it } from "vitest";
import { assessTextQuality, assessChapters, stripOcrArtifacts } from "./quality";

// A real page extracted from a scanned-PDF EPUB upload: an OCR accuracy banner
// followed by garbled Arabic.
const SCANNED_PAGE = `The text on this page is estimated to be only 45.46% accurate
| كل اثراة مَعَنَا مَعَنَا يوَاحَدٍ مِنّ الوْضَعَاءٍ . 0 ٠ ع كله لها اويل ذل نجي 3 لاض ون أنْ حل رَضيعاً 58 في ار امرآةٌ إلا وَمَعَهَا رَضِيْعٌ 0`;

const CLEAN_PAGE = `الفصل الأول: مرضعة النبي
كانت حليمة السعدية امرأة من بني سعد، خرجت تلتمس الرضعاء في عام شديد القحط،
فلم تجد رضيعا إلا وقد ردته أمه رجاء منفعته، فاختارت محمدا صلى الله عليه وسلم.`;

describe("stripOcrArtifacts", () => {
  it("removes OCR accuracy banners but keeps the body", () => {
    const out = stripOcrArtifacts(SCANNED_PAGE);
    expect(out).not.toMatch(/estimated to be only/i);
    expect(out).toContain("مَعَنَا");
  });

  it("leaves clean text untouched", () => {
    expect(stripOcrArtifacts(CLEAN_PAGE)).toBe(CLEAN_PAGE);
  });
});

describe("assessTextQuality", () => {
  it("flags a scanned page carrying an OCR banner", () => {
    const q = assessTextQuality(SCANNED_PAGE);
    expect(q.ocrBanners).toBeGreaterThan(0);
    expect(q.ok).toBe(false);
  });

  it("flags text that is mostly Latin noise", () => {
    const q = assessTextQuality("abcdef ghij klmno pqrst العربية");
    expect(q.ok).toBe(false);
    expect(q.arabicRatio).toBeLessThan(0.85);
  });

  it("passes clean Arabic prose", () => {
    const q = assessTextQuality(CLEAN_PAGE);
    expect(q.ocrBanners).toBe(0);
    expect(q.ok).toBe(true);
  });

  it("counts an OCR banner on every page across chapters", () => {
    const q = assessChapters([{ contentAr: SCANNED_PAGE }, { contentAr: SCANNED_PAGE }]);
    expect(q.ocrBanners).toBe(2);
    expect(q.ok).toBe(false);
  });
});
