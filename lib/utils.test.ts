import { describe, expect, it } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Animal Farm")).toBe("animal-farm");
  });

  it("collapses runs of punctuation and whitespace", () => {
    expect(slugify("  Kalīla  &  Dimna!! ")).toBe("kalila-dimna");
  });

  it("strips diacritics", () => {
    expect(slugify("Qaṣaṣ al-Nabiyyīn")).toBe("qasas-al-nabiyyin");
  });

  it("returns empty when nothing url-safe remains", () => {
    expect(slugify("مزرعة الحيوان")).toBe("");
  });

  it("leaves an already-clean slug unchanged", () => {
    expect(slugify("rihlat-samir")).toBe("rihlat-samir");
  });
});
