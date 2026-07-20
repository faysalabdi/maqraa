/**
 * Parse the plain-text log of an import-pdf GitHub Actions run into something
 * the UI can show. The CLI logs `[n/6]` stage markers and one `chunk x/y` line
 * per reformatted chunk; GitHub prepends a timestamp to every line, so matching
 * is deliberately loose and only ever reports the LAST marker seen.
 */

export type ImportProgress = {
  /** Last [n/6] stage marker seen (1-6), or null before stage 1 logs. */
  stage: number | null;
  /** Last completed chunk (stage 4), or null before the first one. */
  chunkDone: number | null;
  chunkTotal: number | null;
  /** Last non-empty line — surfaced as the error detail on failed runs. */
  lastLine: string;
};

const STAGE_RE = /\[(\d)\/6\]/;
const CHUNK_RE = /chunk (\d+)\/(\d+)/;

export function parseImportProgress(log: string): ImportProgress {
  const lines = log
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let stage: number | null = null;
  let chunkDone: number | null = null;
  let chunkTotal: number | null = null;
  for (const line of lines) {
    const s = STAGE_RE.exec(line);
    if (s) stage = Number(s[1]);
    const c = CHUNK_RE.exec(line);
    if (c) {
      chunkDone = Number(c[1]);
      chunkTotal = Number(c[2]);
    }
  }
  return { stage, chunkDone, chunkTotal, lastLine: lines[lines.length - 1] ?? "" };
}
