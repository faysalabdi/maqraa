import { describe, expect, it } from "vitest";
import { batchPresets, hasMoreAfter, QUICK_START_MAX } from "./review-batch";

describe("batchPresets", () => {
  it("offers nothing when the deck is smaller than the smallest batch", () => {
    expect(batchPresets(8)).toEqual([]);
  });

  it("never offers a batch that would cover the whole deck", () => {
    // 20 due should not offer "20" - that is just reviewing everything, which
    // the All option already covers.
    expect(batchPresets(20)).toEqual([10]);
    expect(batchPresets(21)).toEqual([10, 20]);
  });

  it("offers every preset for a large deck", () => {
    expect(batchPresets(100)).toEqual([10, 20, 30]);
  });
});

describe("hasMoreAfter", () => {
  it("is false once the batches have covered the deck", () => {
    expect(hasMoreAfter(20, 10, 30)).toBe(false);
  });

  it("is true while cards remain behind the current batch", () => {
    expect(hasMoreAfter(0, 10, 30)).toBe(true);
    expect(hasMoreAfter(10, 10, 30)).toBe(true);
  });
});

describe("QUICK_START_MAX", () => {
  it("never shows a picker with no batch to pick", () => {
    // Any deck large enough to ask the question must have a real answer
    // besides "all of them".
    for (const total of [QUICK_START_MAX + 1, 20, 31, 100]) {
      expect(batchPresets(total).length).toBeGreaterThan(0);
    }
  });

  it("auto-starts a deck that is smaller than the first batch", () => {
    expect(batchPresets(QUICK_START_MAX)).toEqual([10]);
  });
});
