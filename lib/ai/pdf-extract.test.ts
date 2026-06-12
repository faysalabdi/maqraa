import { describe, expect, it } from "vitest";
import { isUsableArabicLayer } from "./pdf-extract";

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

describe("isUsableArabicLayer", () => {
  it("accepts a clean logical-order Arabic layer", () => {
    expect(isUsableArabicLayer(CLEAN, 1)).toBe(true);
  });

  it("rejects an empty layer", () => {
    expect(isUsableArabicLayer("", 1)).toBe(false);
  });

  it("rejects transposed-ligature layers from legacy typesetting", () => {
    expect(isUsableArabicLayer(TRANSPOSED, 1)).toBe(false);
  });

  it("rejects layers with too little Arabic for the page count (scans)", () => {
    expect(isUsableArabicLayer("صفحة ١٩", 10)).toBe(false);
  });

  it("rejects presentation-form glyph soup", () => {
    // U+FE8D / U+FEDF / U+FEA4 — isolated/initial form glyphs, not real text.
    const soup = "ﺍﻟﺤﻤﺪ ".repeat(60);
    expect(isUsableArabicLayer(soup, 1)).toBe(false);
  });
});
