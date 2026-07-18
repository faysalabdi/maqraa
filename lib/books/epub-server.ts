import "server-only";
import JSZip from "jszip";
import { splitIntoChapters, type DraftChapter } from "@/lib/books/split";

/**
 * Server-side EPUB → chapter drafts for the mobile upload path. The browser
 * parser (lib/books/epub.ts) leans on DOMParser/TreeWalker and can't run in
 * React Native, so the phone posts the raw file here instead. This parser is
 * deliberately simpler than the web one: spine order from the OPF via regex,
 * text extracted by stripping tags, one chapter per spine document (merged
 * through the heading splitter when the book is a single flat document).
 */

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** XHTML → readable plain text: block tags become newlines, the rest is stripped. */
function htmlToText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return decodeEntities(
    body
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, "\n\n$2\n\n")
      .replace(/<\/(p|div|section|li|blockquote|tr)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(re: RegExp, s: string): string | null {
  return s.match(re)?.[1] ?? null;
}

export type ParsedEpub = {
  titleHint: string;
  authorHint: string | null;
  chapters: DraftChapter[];
};

export async function parseEpubServer(buf: ArrayBuffer | Buffer): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(buf);

  const container = await zip.file("META-INF/container.xml")?.async("string");
  if (!container) throw new Error("not a valid EPUB (missing container.xml)");
  const opfPath = firstMatch(/full-path="([^"]+)"/, container);
  if (!opfPath) throw new Error("not a valid EPUB (no OPF path)");
  const opf = await zip.file(opfPath)?.async("string");
  if (!opf) throw new Error("not a valid EPUB (missing OPF)");
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const titleHint = decodeEntities(
    firstMatch(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i, opf) ?? "",
  ).trim();
  const authorHint = firstMatch(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i, opf);

  // Manifest id → href, then spine order.
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\s+[^>]*>/gi)) {
    const tag = m[0];
    const id = firstMatch(/\bid="([^"]+)"/, tag);
    const href = firstMatch(/\bhref="([^"]+)"/, tag);
    const type = firstMatch(/\bmedia-type="([^"]+)"/, tag) ?? "";
    if (id && href && /html|xml/i.test(type)) manifest.set(id, href);
  }
  const spineIds = [...opf.matchAll(/<itemref\s+[^>]*idref="([^"]+)"[^>]*\/?>/gi)].map(
    (m) => m[1],
  );

  const texts: string[] = [];
  for (const id of spineIds) {
    const href = manifest.get(id);
    if (!href) continue;
    const raw = await zip
      .file(decodeURIComponent(opfDir + href).replace(/#.*$/, ""))
      ?.async("string");
    if (!raw) continue;
    const text = htmlToText(raw);
    if (text.length > 40) texts.push(text);
  }
  if (texts.length === 0) throw new Error("no readable text found in the EPUB");

  // Multi-document spine: one chapter per document. Flat single-document books
  // go through the heading splitter instead.
  let chapters: DraftChapter[];
  if (texts.length > 1) {
    chapters = texts.map((t, i) => {
      const firstLine = t.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
      const title = firstLine.length <= 80 ? firstLine : "";
      return {
        titleAr: title || `الفصل ${i + 1}`,
        titleEn: `Chapter ${i + 1}`,
        contentAr: t,
      };
    });
  } else {
    chapters = splitIntoChapters(texts[0], { mode: "heading" });
  }

  return { titleHint, authorHint: authorHint ? decodeEntities(authorHint).trim() : null, chapters };
}
