import { describe, expect, it } from "vitest";
import { classifyArabicLayer, stripRunningHeadersFooters } from "./pdf-extract";

// Clean logical-order Arabic (what a healthy text layer contains).
const CLEAN =
  "الحقيقة هي أن الانتظار لا يحدث تغييرا والتردد لا ينقذك من دوامة الأيام المتكررة، " +
  "تلك الأيام التي تبدو كنسخة باهتة عن بعضها البعض وتسرق من روحك شغفها دون أن تشعر. " +
  "رمضان ليس مجرد شهر للصيام، بل هو فرصة ذهبية لتعيد تشكيل ذاتك في حياتك، " +
  "فرصة قد لا تتكرر بهذه القوة. لذا، إن لم تتغير الآن فمتى؟ " +
  "لأن رمضان بطبيعته شهر الانقطاع عن المألوف، هو محطة روحية إجبارية تكسر روتين الجسد.";

// The same passage as a legacy transposed-ligature layer: real Arabic
// codepoints, lam-ligature pairs swapped (الحقيقة → احلقيقة, في → يف,
// إلى → إىل, الأيام → األيام). This is what the broken book actually
// extracted to.
const TRANSPOSED =
  "احلقيقة هي أن االنتظار ال يحدث تغيريا والرتدد ال ينقذك من دوامة األيام املتكررة، " +
  "تلك األيام التي تبدو كنسخة باهتة يف حياتك، وكم من مرة قررت أن تبدأ ثم أجلت " +
  "اخلطوة إىل وقت آخر؟ رمضان ليس جمرد شهر للصيام بل هو فرصة ذهبية لتعيد تشكيل " +
  "ذاتك يف هذه األيام اجلميلة، فرصة قد ال تتكرر. عىل خري إن شاء اهلل حىت نلتقي.";

describe("classifyArabicLayer", () => {
  it("classifies a clean logical-order Arabic layer as clean", () => {
    expect(classifyArabicLayer(CLEAN, 1)).toBe("clean");
  });

  it("classifies an empty layer as unusable", () => {
    expect(classifyArabicLayer("", 1)).toBe("unusable");
  });

  it("classifies transposed-ligature layers as transposed (repairable)", () => {
    expect(classifyArabicLayer(TRANSPOSED, 1)).toBe("transposed");
  });

  it("classifies layers with too little Arabic for the page count as unusable (scans)", () => {
    expect(classifyArabicLayer("صفحة ١٩", 10)).toBe("unusable");
  });

  it("classifies presentation-form glyph soup as unusable", () => {
    // U+FE8D / U+FEDF / U+FEA4 — isolated/initial form glyphs, not real text.
    const soup = "ﺍﻟﺤﻤﺪ ".repeat(60);
    expect(classifyArabicLayer(soup, 1)).toBe("unusable");
  });
});

describe("stripRunningHeadersFooters", () => {
  // The actual header from the broken book in the user's screenshot, varying
  // the page number across pages — what real OCR output looks like.
  const HEADER = (n: number) => `ما لم يخبرك به أحد ${n}`;
  const BODY = "هذا هو نص الكتاب الفعلي الذي نريد قراءته في هذه الصفحة.";

  it("strips a running header that repeats across pages with varying page numbers", () => {
    const pages = [
      `${HEADER(17)}\n${BODY}`,
      `${HEADER(18)}\n${BODY}`,
      `${HEADER(19)}\n${BODY}`,
      `${HEADER(20)}\n${BODY}`,
    ];
    const cleaned = stripRunningHeadersFooters(pages);
    for (const page of cleaned) {
      expect(page).not.toContain("يخبرك");
      expect(page).toContain(BODY);
    }
  });

  it("strips a running footer with a different label", () => {
    const pages = [
      `${BODY}\nالفصل الأول`,
      `${BODY}\nالفصل الأول`,
      `${BODY}\nالفصل الأول`,
    ];
    const cleaned = stripRunningHeadersFooters(pages);
    for (const page of cleaned) {
      expect(page).not.toContain("الفصل");
      expect(page).toContain(BODY);
    }
  });

  it("strips standalone page-number lines anywhere", () => {
    const pages = ["19\n" + BODY + "\n20"];
    const cleaned = stripRunningHeadersFooters(pages);
    expect(cleaned[0]).not.toMatch(/^19/);
    expect(cleaned[0]).not.toMatch(/20$/);
    expect(cleaned[0]).toContain(BODY);
  });

  it("preserves a unique chapter title that only appears on one page", () => {
    const pages = [
      `الفصل الأول\n${BODY}`,
      `${BODY}\n${BODY}`,
      `${BODY}\n${BODY}`,
    ];
    const cleaned = stripRunningHeadersFooters(pages);
    expect(cleaned[0]).toContain("الفصل الأول");
  });

  it("never strips long lines mistaken for headers", () => {
    const longLine =
      "هذا سطر طويل جدا يحتوي على كثير من الكلمات ويظهر في عدة صفحات لكنه ليس عنوانا.";
    const pages = [longLine, longLine, longLine, longLine];
    const cleaned = stripRunningHeadersFooters(pages);
    for (const page of cleaned) expect(page).toBe(longLine);
  });
});
