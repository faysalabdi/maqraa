import { describe, it, expect } from "vitest";
import { chunkPages, PAGE_MARKER, OVERLAP_OPEN, OVERLAP_CLOSE, type PdfPage } from "./chunk";

const pages = (texts: string[]): PdfPage[] => texts.map((t, i) => ({ page: i + 1, text: t }));

describe("chunkPages", () => {
  it("marks every page and preserves order", () => {
    const [chunk] = chunkPages(pages(["one", "two", "three"]));
    expect(chunk.fromPage).toBe(1);
    expect(chunk.toPage).toBe(3);
    expect(chunk.text).toContain(`${PAGE_MARKER(1)}\none`);
    expect(chunk.text).toContain(`${PAGE_MARKER(2)}\ntwo`);
    expect(chunk.text.indexOf("one")).toBeLessThan(chunk.text.indexOf("three"));
  });

  it("respects the page cap, breaking only on page boundaries", () => {
    const chunks = chunkPages(pages(["a", "b", "c", "d", "e"]), { pagesPerChunk: 2 });
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => [c.fromPage, c.toPage])).toEqual([
      [1, 2],
      [3, 4],
      [5, 5],
    ]);
  });

  it("respects the char cap without splitting a page", () => {
    const big = "x".repeat(900);
    const chunks = chunkPages(pages([big, big, big]), { maxCharsPerChunk: 1000 });
    // Each 900-char page gets its own chunk even though the cap is 1000.
    expect(chunks).toHaveLength(3);
  });

  it("prepends a tagged overlap tail to every chunk after the first", () => {
    const tail = "z".repeat(500);
    const chunks = chunkPages(pages([tail, "second page"]), {
      pagesPerChunk: 1,
      overlapChars: 100,
    });
    expect(chunks[0].text).not.toContain(OVERLAP_OPEN);
    expect(chunks[1].text).toContain(OVERLAP_OPEN);
    expect(chunks[1].text).toContain(OVERLAP_CLOSE);
    expect(chunks[1].text).toContain("z".repeat(100));
    expect(chunks[1].text).toContain(`${PAGE_MARKER(2)}\nsecond page`);
  });

  it("skips empty pages", () => {
    const chunks = chunkPages(pages(["", "  ", "real text"]));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].fromPage).toBe(3);
  });
});
