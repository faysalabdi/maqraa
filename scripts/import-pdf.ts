/**
 * Import an Arabic-book PDF into the catalogue (books + book_chapters).
 *
 *   pnpm import-pdf --pdf ./book.pdf --slug al-something --level 3 \
 *     --title-ar "..." --title-en "..." --author-ar "..." \
 *     --genre classical --difficulty 3 [--order 2] [--blurb "..."] \
 *     [--force-ocr] [--dry-run] [--out chapters.json]
 *
 * Pipeline: extract (Python sidecar: PyMuPDF text layer, or rendered page
 * images for scans) → normalize → chunk → Claude clean+chapter (text, or
 * vision for scans) → stitch → insert. Re-running with the same slug REPLACES
 * that book's chapters in one transaction (owner progress on the old chapters
 * is dropped), so a bad run is fixable. --dry-run stops before the DB write.
 *
 * Env (from .env.local): DATABASE_URL (or DIRECT_URL), ANTHROPIC_API_KEY, and
 * a model (ANTHROPIC_IMPORT_MODEL, else ANTHROPIC_TEST_MODEL). Python:
 * scripts/pdf-extract/.venv is used when present, else PDF_EXTRACT_PYTHON,
 * else python3.
 *
 * Legal: public-domain / CC / properly licensed PDFs only (Shamela, Hindawi,
 * archive.org). See docs/CONTENT-SOURCING.md.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { normalizePage, countArabicChars } from "../lib/import/normalize";
import { chunkPages } from "../lib/import/chunk";
import {
  reformatChunks,
  reformatImageChunks,
  importModelFromEnv,
  type ImageChunk,
  type ReformattedChunk,
} from "../lib/import/reformat";
import { stitchChunks, validateChapters } from "../lib/import/stitch";

const execFileAsync = promisify(execFile);

const GENRES = ["islamic", "arabic_literature", "translated", "graded_reader", "classical"] as const;
type Genre = (typeof GENRES)[number];

type CliArgs = {
  pdf: string;
  slug: string;
  level: number;
  titleAr: string;
  titleEn: string;
  authorAr?: string;
  authorEn?: string;
  genre: Genre;
  difficulty: number;
  order?: number;
  blurb?: string;
  pagesPerChunk: number;
  concurrency: number;
  forceOcr: boolean;
  dpi: number;
  dryRun: boolean;
  out?: string;
  guidance?: string;
};

function usage(): never {
  console.error(`Usage:
  pnpm import-pdf --pdf <file.pdf> --slug <slug> --title-ar <t> --title-en <t>
    [--level N] [--order N] [--author-ar T] [--author-en T]
    [--genre ${GENRES.join("|")}] [--difficulty 1-5] [--blurb T]
    [--pages-per-chunk N] [--concurrency N] [--force-ocr] [--dpi N]
    [--guidance "book-specific chapter/front-matter steering"]
    [--dry-run] [--out chapters.json]`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const getInt = (name: string, fallback?: number): number | undefined => {
    const v = get(name);
    if (v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      console.error(`--${name} must be a number, got "${v}"`);
      usage();
    }
    return n;
  };

  const pdf = get("pdf");
  const slug = get("slug");
  const titleAr = get("title-ar");
  const titleEn = get("title-en");
  if (!pdf || !slug || !titleAr || !titleEn) usage();
  if (argv.includes("--help") || argv.includes("-h")) usage();

  const genre = (get("genre") ?? "classical") as Genre;
  if (!GENRES.includes(genre)) {
    console.error(`--genre must be one of: ${GENRES.join(", ")}`);
    usage();
  }
  const difficulty = getInt("difficulty", 3)!;
  if (difficulty < 1 || difficulty > 5) {
    console.error("--difficulty must be 1..5");
    usage();
  }

  return {
    pdf,
    slug,
    titleAr,
    titleEn,
    level: getInt("level", 3)!,
    order: getInt("order"),
    authorAr: get("author-ar"),
    authorEn: get("author-en"),
    genre,
    difficulty,
    blurb: get("blurb"),
    pagesPerChunk: getInt("pages-per-chunk", 12)!,
    concurrency: getInt("concurrency", 3)!,
    forceOcr: argv.includes("--force-ocr"),
    dpi: getInt("dpi", 150)!,
    dryRun: argv.includes("--dry-run"),
    out: get("out"),
    guidance: get("guidance"),
  };
}

function pythonBin(): string {
  if (process.env.PDF_EXTRACT_PYTHON) return process.env.PDF_EXTRACT_PYTHON;
  const venv = resolve(__dirname, "pdf-extract/.venv/bin/python");
  return existsSync(venv) ? venv : "python3";
}

const log = (msg: string) => console.log(msg);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  // ── Stage 1: extract ────────────────────────────────────────────────
  log(`\n[1/6] Extracting ${args.pdf} …`);
  const extractor = resolve(__dirname, "pdf-extract/extract.py");
  const pyArgs = [extractor, resolve(args.pdf), "--dpi", String(args.dpi)];
  if (args.forceOcr) pyArgs.push("--force-ocr");
  const { stdout, stderr } = await execFileAsync(pythonBin(), pyArgs, {
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (stderr.trim()) log(stderr.trim());
  const extracted = JSON.parse(stdout) as
    | { mode: "text"; pages: { page: number; text: string }[] }
    | { mode: "vision"; pages: { page: number; image_b64: string }[] };
  if (!extracted.pages?.length) throw new Error("extractor returned no pages");
  log(
    `  → ${extracted.pages.length} pages (${extracted.mode === "vision" ? "scanned → Claude vision" : "text layer"})`,
  );

  const model = importModelFromEnv();
  let outputs: ReformattedChunk[];

  if (extracted.mode === "text") {
    // ── Stage 2: normalize ──────────────────────────────────────────────
    log("\n[2/6] Normalizing…");
    const pages = extracted.pages.map((p) => ({ page: p.page, text: normalizePage(p.text) }));
    const arabicChars = pages.reduce((n, p) => n + countArabicChars(p.text), 0);
    log(`  → ${arabicChars} Arabic chars across ${pages.length} pages`);
    if (arabicChars < pages.length * 30) {
      throw new Error("too little Arabic text after normalize — try --force-ocr for a scanned PDF");
    }

    // ── Stage 3: chunk ────────────────────────────────────────────────
    const chunks = chunkPages(pages, { pagesPerChunk: args.pagesPerChunk });
    log(`\n[3/6] Chunked → ${chunks.length} chunk(s) of ≤${args.pagesPerChunk} pages`);

    // ── Stage 4: clean + chapter (text) ───────────────────────────────
    log(`\n[4/6] Reformatting with ${model} (${chunks.length} chunks, concurrency ${args.concurrency})…`);
    outputs = await reformatChunks(chunks, { model, onLog: log, guidance: args.guidance }, args.concurrency);
  } else {
    // Vision path: page images are token-heavy, so cap pages/chunk lower.
    log("\n[2/6] Normalizing… (skipped — vision reads page images directly)");
    const imgPerChunk = Math.min(args.pagesPerChunk, 6);
    const imageChunks: ImageChunk[] = [];
    for (let i = 0; i < extracted.pages.length; i += imgPerChunk) {
      const slice = extracted.pages.slice(i, i + imgPerChunk);
      imageChunks.push({
        index: imageChunks.length,
        fromPage: slice[0].page,
        toPage: slice[slice.length - 1].page,
        images: slice.map((p) => ({ page: p.page, b64: p.image_b64 })),
      });
    }
    log(`\n[3/6] Chunked → ${imageChunks.length} chunk(s) of ≤${imgPerChunk} pages (vision)`);
    log(
      `\n[4/6] Reformatting with ${model} vision (${imageChunks.length} chunks, concurrency ${args.concurrency})…`,
    );
    outputs = await reformatImageChunks(imageChunks, { model, onLog: log, guidance: args.guidance }, args.concurrency);
  }

  // ── Stage 5: stitch ─────────────────────────────────────────────────
  const chapters = stitchChunks(outputs);
  const warnings = validateChapters(chapters);
  log(`\n[5/6] Stitched → ${chapters.length} chapters`);
  for (const w of warnings) log(`  ⚠ ${w}`);
  for (const c of chapters) log(`  ${String(c.chapterNumber).padStart(3)}. ${c.titleAr} (${c.contentAr.length} chars)`);

  if (args.out) {
    await writeFile(args.out, JSON.stringify(chapters, null, 2), "utf8");
    log(`  → wrote ${args.out}`);
  }
  if (args.dryRun) {
    log(`\n--dry-run: stopping before the DB write (${((Date.now() - t0) / 1000).toFixed(0)}s).`);
    return;
  }

  // ── Stage 6: insert ─────────────────────────────────────────────────
  log("\n[6/6] Writing to the database…");
  const [{ importCuratedBookCore }, { db, schema }] = await Promise.all([
    import("@/server/core/books"),
    import("@/lib/db"),
  ]);

  const levelRows = await db.select({ level: schema.levels.level }).from(schema.levels);
  const levels = levelRows.map((r) => r.level);
  if (levels.length > 0 && !levels.includes(args.level)) {
    throw new Error(`level ${args.level} doesn't exist (have: ${levels.sort((a, b) => a - b).join(", ")})`);
  }

  const result = await importCuratedBookCore(
    {
      slug: args.slug,
      level: args.level,
      orderInLevel: args.order,
      titleAr: args.titleAr,
      titleEn: args.titleEn,
      authorAr: args.authorAr,
      authorEn: args.authorEn,
      blurb: args.blurb ?? `${args.titleAr}${args.authorAr ? ` — ${args.authorAr}` : ""}`,
      difficulty: args.difficulty,
      genre: args.genre,
    },
    chapters.map((c) => ({ titleAr: c.titleAr, titleEn: c.titleEn, contentAr: c.contentAr })),
  );
  log(
    `\nDone: ${result.replaced ? "replaced" : "created"} "${result.slug}" — ` +
      `${result.chapters} chapters, has_full_text=true (${((Date.now() - t0) / 1000).toFixed(0)}s).`,
  );
  process.exit(0); // drop the DB pool instead of waiting on idle connections
}

main().catch((e) => {
  console.error(`\nimport-pdf failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
