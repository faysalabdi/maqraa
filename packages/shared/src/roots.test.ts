import { describe, expect, it } from "vitest";
import { familyCoverage, groupByRoot, relatedFamilies, type RootWord } from "./roots";

const word = (id: string, lemma: string, pattern: string | null = null): RootWord => ({
  id,
  lemma_ar: lemma,
  gloss_en: id,
  pattern,
});

const ROOTS: Record<string, string | null> = {
  "كِتَاب": "ك ت ب",
  "كَاتِب": "ك ت ب",
  "مَكْتَبَة": "ك ت ب",
  "دَرْس": "د ر س",
  "مُدَرِّس": "د ر س",
  "سَفِينَة": null,
};
const rootOf = (w: RootWord) => ROOTS[w.lemma_ar] ?? null;

describe("groupByRoot", () => {
  it("puts words sharing a root together, largest family first", () => {
    const families = groupByRoot(
      [word("a", "دَرْس"), word("b", "كِتَاب"), word("c", "كَاتِب"), word("d", "مُدَرِّس"), word("e", "مَكْتَبَة")],
      rootOf,
    );
    expect(families.map((f) => f.root)).toEqual(["ك ت ب", "د ر س"]);
    expect(families[0].words).toHaveLength(3);
  });

  it("drops words whose root is unknown rather than bucketing them", () => {
    // A bucket of unrelated words under one heading teaches the wrong thing.
    const families = groupByRoot([word("a", "سَفِينَة"), word("b", "كِتَاب")], rootOf);
    expect(families.map((f) => f.root)).toEqual(["ك ت ب"]);
  });

  it("counts the same lemma saved twice as one word", () => {
    const families = groupByRoot([word("a", "كِتَاب"), word("b", "كِتَاب")], rootOf);
    expect(families[0].words).toHaveLength(1);
  });

  it("orders equally sized families deterministically", () => {
    const a = groupByRoot([word("a", "كِتَاب"), word("b", "دَرْس")], rootOf);
    const b = groupByRoot([word("b", "دَرْس"), word("a", "كِتَاب")], rootOf);
    expect(a.map((f) => f.root)).toEqual(b.map((f) => f.root));
  });
});

describe("relatedFamilies", () => {
  it("hides a root the reader has only met once", () => {
    const families = groupByRoot([word("a", "كِتَاب"), word("b", "دَرْس")], rootOf);
    expect(relatedFamilies(families)).toEqual([]);
  });

  it("keeps a root once a second word shares it", () => {
    const families = groupByRoot([word("a", "كِتَاب"), word("b", "كَاتِب")], rootOf);
    expect(relatedFamilies(families)).toHaveLength(1);
  });
});

describe("familyCoverage", () => {
  it("counts only the words that sit in a real family", () => {
    const families = groupByRoot(
      [word("a", "كِتَاب"), word("b", "كَاتِب"), word("c", "دَرْس"), word("d", "سَفِينَة")],
      rootOf,
    );
    expect(familyCoverage(families)).toEqual({ families: 1, words: 2 });
  });
});
