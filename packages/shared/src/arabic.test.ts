import { describe, expect, it } from "vitest";
import { cleanWord, lookupKey, matchKey, stripDiacritics, vocalizedKey } from "./arabic";

describe("matchKey", () => {
  it("ignores diacritics, so a vowelled save matches bare text", () => {
    expect(matchKey("كِتَابٌ")).toBe(matchKey("كتاب"));
  });

  it("strips the definite article", () => {
    expect(matchKey("الكتاب")).toBe(matchKey("كتاب"));
    expect(matchKey("وَالْكِتَابُ")).toBe(matchKey("كتاب"));
  });

  it("strips the article through an attached conjunction or preposition", () => {
    expect(matchKey("والكتاب")).toBe(matchKey("كتاب"));
    expect(matchKey("بالكتاب")).toBe(matchKey("كتاب"));
    expect(matchKey("للكتاب")).toBe(matchKey("كتاب"));
  });

  it("leaves a bare one-letter prefix alone rather than mangling the word", () => {
    // Stripping "ك" here would reduce كتاب to تاب and match the wrong word.
    expect(matchKey("كتاب")).toBe("كتاب");
    expect(matchKey("وجه")).toBe("وجه");
    expect(matchKey("بيت")).toBe("بيت");
  });

  it("folds alef, ya and ta marbuta variants", () => {
    expect(matchKey("أحمد")).toBe(matchKey("احمد"));
    expect(matchKey("موسى")).toBe(matchKey("موسي"));
    expect(matchKey("مدينة")).toBe(matchKey("مدينه"));
  });

  it("keeps short words whole rather than stripping them to nothing", () => {
    // "لك" is two letters; taking "ل" off would leave a single letter.
    expect(matchKey("لك")).toBe("لك");
    expect(matchKey("في")).toBe("في");
  });

  it("does not collapse genuinely different words", () => {
    expect(matchKey("كتاب")).not.toBe(matchKey("كتب"));
    expect(matchKey("بيت")).not.toBe(matchKey("باب"));
  });

  it("survives punctuation attached to the token", () => {
    expect(matchKey("الكتاب،")).toBe(matchKey("كتاب"));
  });
});

describe("the lookup keys it must not disturb", () => {
  it("lookupKey still only cleans, so distinct words stay distinct", () => {
    expect(lookupKey("الكتاب")).not.toBe(lookupKey("كتاب"));
  });

  it("vocalizedKey still separates homographs by vowelling", () => {
    expect(vocalizedKey("عَلَم")).not.toBe(vocalizedKey("عِلْم"));
  });

  it("cleanWord and stripDiacritics are unchanged", () => {
    expect(stripDiacritics("كِتَابٌ")).toBe("كتاب");
    expect(cleanWord("كِتَابٌ،")).toBe("كتاب");
  });
});
