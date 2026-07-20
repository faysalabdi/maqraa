import { describe, expect, it } from "vitest";
import { parseImportProgress } from "./progress";

// GitHub job logs arrive with an ISO timestamp prefix on every line.
const RUNNING_LOG = `2026-07-20T00:00:01.0000000Z
2026-07-20T00:00:02.0000000Z [1/6] Extracting import.pdf …
2026-07-20T00:00:20.0000000Z   → 214 pages (text layer)
2026-07-20T00:00:21.0000000Z [2/6] Normalizing…
2026-07-20T00:00:22.0000000Z [3/6] Chunked → 18 chunk(s) of ≤12 pages
2026-07-20T00:00:23.0000000Z [4/6] Reformatting with claude-x (18 chunks, concurrency 3)…
2026-07-20T00:01:10.0000000Z   chunk 1/18 (pages 1–12): 2 block(s), 47s
2026-07-20T00:01:55.0000000Z   chunk 2/18 (pages 13–24): 1 block(s), 44s
`;

describe("parseImportProgress", () => {
  it("reports the last stage and chunk seen", () => {
    const p = parseImportProgress(RUNNING_LOG);
    expect(p.stage).toBe(4);
    expect(p.chunkDone).toBe(2);
    expect(p.chunkTotal).toBe(18);
  });

  it("returns the last non-empty line", () => {
    expect(parseImportProgress(RUNNING_LOG).lastLine).toContain("chunk 2/18");
  });

  it("handles an empty log (run not started)", () => {
    const p = parseImportProgress("");
    expect(p.stage).toBeNull();
    expect(p.chunkDone).toBeNull();
    expect(p.chunkTotal).toBeNull();
    expect(p.lastLine).toBe("");
  });

  it("keeps earlier chunk numbers once the import moves past stage 4", () => {
    const p = parseImportProgress(`${RUNNING_LOG}\n2026-07-20T00:05:00.0000000Z [5/6] Stitched → 21 chapters\n`);
    expect(p.stage).toBe(5);
    expect(p.chunkDone).toBe(2);
  });
});
