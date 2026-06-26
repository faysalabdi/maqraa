import JSZip from "jszip";
import type { DraftChapter } from "./split";
import { stripOcrArtifacts } from "./quality";

export type EpubMeta = { title: string; author: string; language: string };
export type EpubBook = { meta: EpubMeta; chapters: DraftChapter[] };

/**
 * Parse an EPUB in the browser into real chapter drafts.
 *
 * An EPUB's spine is a list of XHTML documents in reading order, but those
 * documents are often *pages*, not chapters — a single chapter can span many
 * spine files. Splitting per spine file therefore explodes a book into hundreds
 * of fragments. Instead we read the book's own table of contents (EPUB3 `nav`
 * or EPUB2 `toc.ncx`), treat each TOC entry as a chapter boundary, and merge the
 * spine text between boundaries into one chapter. No OCR, no glyph repair —
 * clean source in, clean chapters out.
 */

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function resolvePath(base: string, rel: string): string {
  const target = decodeURIComponent(rel.split("#")[0]);
  const parts = (base ? `${base}/${target}` : target).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function clean(text: string): string {
  return stripOcrArtifacts(
    text
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim(),
  );
}

function prepareDoc(html: string): Document {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((n) => n.remove());
  // Mark block boundaries so paragraphs survive textContent flattening. Block
  // elements get a blank line (paragraph break) so the reader splits them into
  // real paragraphs; <br> is only a soft line break.
  doc
    .querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, tr, blockquote, section, figure")
    .forEach((el) => el.append("\n\n"));
  doc.querySelectorAll("br").forEach((el) => el.append("\n"));
  return doc;
}

function firstHeading(doc: Document): string {
  const h = doc.querySelector("h1, h2, h3, title");
  return (h?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function wholeText(doc: Document): string {
  return clean(doc.body?.textContent ?? "");
}

type Toc = { path: string; anchor: string | null; label: string };

/** Split one file's text at anchor boundaries. Text before the first anchor is `pre`. */
function fileToSegments(
  doc: Document,
  anchors: (string | null)[],
): { pre: string; segs: string[] } {
  const meaningful = anchors.filter((a) => a);
  if (meaningful.length <= 1) {
    // Single boundary (or a file-level entry): the whole file is one segment.
    return { pre: "", segs: [wholeText(doc)] };
  }

  const els = anchors.map((a) => {
    if (!a) return null;
    try {
      return doc.getElementById(a) || doc.querySelector(`[name="${CSS.escape(a)}"]`);
    } catch {
      return doc.getElementById(a);
    }
  });

  const segs = anchors.map(() => "");
  let pre = "";
  let seg = anchors[0] ? -1 : 0;
  const passed = (node: Node, el: Element) =>
    (el.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  const walker = doc.createTreeWalker(doc.body ?? doc, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    while (seg + 1 < els.length && els[seg + 1] && passed(node, els[seg + 1] as Element)) seg++;
    const txt = node.nodeValue ?? "";
    if (seg < 0) pre += txt;
    else segs[seg] += txt;
    node = walker.nextNode();
  }

  return { pre: clean(pre), segs: segs.map(clean) };
}

function parseNavToc(navHtml: string, navDir: string, spinePaths: Set<string>): Toc[] {
  const doc = new DOMParser().parseFromString(navHtml, "text/html");
  const navs = Array.from(doc.querySelectorAll("nav"));
  const tocNav =
    navs.find((n) => (n.getAttribute("epub:type") || n.getAttribute("type") || "").includes("toc")) ??
    navs[0];
  if (!tocNav) return [];
  const out: Toc[] = [];
  tocNav.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    const path = resolvePath(navDir, href);
    if (!spinePaths.has(path)) return;
    const anchor = href.includes("#") ? decodeURIComponent(href.split("#")[1]) : null;
    out.push({ path, anchor, label: (a.textContent ?? "").replace(/\s+/g, " ").trim() });
  });
  return out;
}

function parseNcxToc(ncxXml: string, ncxDir: string, spinePaths: Set<string>): Toc[] {
  const doc = new DOMParser().parseFromString(ncxXml, "application/xml");
  const points = doc.getElementsByTagNameNS("*", "navPoint");
  const out: Toc[] = [];
  for (let i = 0; i < points.length; i++) {
    const src = points[i]
      .getElementsByTagNameNS("*", "content")[0]
      ?.getAttribute("src");
    if (!src) continue;
    const path = resolvePath(ncxDir, src);
    if (!spinePaths.has(path)) continue;
    const label = (
      points[i].getElementsByTagNameNS("*", "navLabel")[0]?.textContent ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const anchor = src.includes("#") ? decodeURIComponent(src.split("#")[1]) : null;
    out.push({ path, anchor, label });
  }
  return out;
}

export async function parseEpub(file: File): Promise<DraftChapter[]> {
  return (await parseEpubBook(file)).chapters;
}

export async function parseEpubBook(file: File): Promise<EpubBook> {
  const zip = await JSZip.loadAsync(file);

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Not a valid EPUB (missing META-INF/container.xml).");
  const container = new DOMParser().parseFromString(
    await containerFile.async("string"),
    "application/xml",
  );
  const opfPath = container.getElementsByTagNameNS("*", "rootfile")[0]?.getAttribute("full-path");
  if (!opfPath) throw new Error("Could not locate the EPUB package file.");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("EPUB package file is missing.");
  const opf = new DOMParser().parseFromString(await opfFile.async("string"), "application/xml");
  const opfDir = dirname(opfPath);

  const md = opf.getElementsByTagNameNS("*", "metadata")[0];
  const metaText = (tag: string) =>
    (md?.getElementsByTagNameNS("*", tag)[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
  const meta: EpubMeta = {
    title: metaText("title"),
    author: metaText("creator"),
    language: metaText("language"),
  };

  const manifest: Record<string, { href: string; type: string; properties: string }> = {};
  const items = opf.getElementsByTagNameNS("*", "item");
  for (let i = 0; i < items.length; i++) {
    const id = items[i].getAttribute("id");
    const href = items[i].getAttribute("href");
    if (id && href)
      manifest[id] = {
        href,
        type: items[i].getAttribute("media-type") ?? "",
        properties: items[i].getAttribute("properties") ?? "",
      };
  }

  // Ordered spine of HTML documents.
  const itemrefs = opf.getElementsByTagNameNS("*", "itemref");
  const spine: { path: string }[] = [];
  for (let i = 0; i < itemrefs.length; i++) {
    const idref = itemrefs[i].getAttribute("idref");
    if (!idref) continue;
    const item = manifest[idref];
    if (!item) continue;
    if (item.type && !item.type.includes("html")) continue;
    spine.push({ path: resolvePath(opfDir, item.href) });
  }
  if (spine.length === 0) throw new Error("No readable documents found in this EPUB.");
  const spinePaths = new Set(spine.map((s) => s.path));

  // Find the table of contents — EPUB3 nav first, then EPUB2 ncx.
  let toc: Toc[] = [];
  const navItem = Object.values(manifest).find((m) => m.properties.split(/\s+/).includes("nav"));
  if (navItem) {
    const navPath = resolvePath(opfDir, navItem.href);
    const f = zip.file(navPath);
    if (f) toc = parseNavToc(await f.async("string"), dirname(navPath), spinePaths);
  }
  if (toc.length < 2) {
    const spineEl = opf.getElementsByTagNameNS("*", "spine")[0];
    const ncxId = spineEl?.getAttribute("toc");
    const ncx =
      (ncxId && manifest[ncxId]) ||
      Object.values(manifest).find((m) => m.type.includes("dtbncx"));
    if (ncx) {
      const ncxPath = resolvePath(opfDir, ncx.href);
      const f = zip.file(ncxPath);
      if (f) toc = parseNcxToc(await f.async("string"), dirname(ncxPath), spinePaths);
    }
  }

  const fileHtml = async (path: string) => (await zip.file(path)?.async("string")) ?? "";

  // No usable TOC: fall back to one chapter per spine document.
  if (toc.length < 2) {
    const chapters: DraftChapter[] = [];
    for (const s of spine) {
      const doc = prepareDoc(await fileHtml(s.path));
      const text = wholeText(doc);
      if (text.length < 10) continue;
      const n = chapters.length + 1;
      chapters.push({
        titleAr: firstHeading(doc) || `الفصل ${n}`,
        titleEn: `Chapter ${n}`,
        contentAr: text,
      });
    }
    if (chapters.length === 0) throw new Error("No readable text found in this EPUB.");
    return { meta, chapters };
  }

  // TOC-driven assembly: merge the spine text between chapter boundaries.
  const tocByPath = new Map<string, Toc[]>();
  for (const t of toc) {
    const arr = tocByPath.get(t.path) ?? [];
    arr.push(t);
    tocByPath.set(t.path, arr);
  }

  const built: { title: string | null; parts: string[] }[] = [];
  let cur: { title: string | null; parts: string[] } | null = null;
  const flush = () => {
    if (cur && cur.parts.join("").trim()) built.push(cur);
    cur = null;
  };

  for (const s of spine) {
    const entries = tocByPath.get(s.path);
    const doc = prepareDoc(await fileHtml(s.path));
    if (!entries || entries.length === 0) {
      const text = wholeText(doc);
      if (!text) continue;
      if (cur) cur.parts.push(text);
      else cur = { title: null, parts: [text] };
      continue;
    }
    const { pre, segs } = fileToSegments(doc, entries.map((e) => e.anchor));
    if (pre) {
      if (cur) cur.parts.push(pre);
      else cur = { title: null, parts: [pre] };
    }
    entries.forEach((e, idx) => {
      flush();
      cur = { title: e.label || null, parts: [segs[idx] ?? ""] };
    });
  }
  flush();

  const chapters: DraftChapter[] = built
    .map((b) => ({ title: b.title, contentAr: clean(b.parts.join("\n\n")) }))
    .filter((b) => b.contentAr.length >= 10)
    .map((b, i) => ({
      titleAr: b.title || `الفصل ${i + 1}`,
      titleEn: `Chapter ${i + 1}`,
      contentAr: b.contentAr,
    }));

  if (chapters.length === 0) throw new Error("No readable text found in this EPUB.");
  return { meta, chapters };
}
