import JSZip from "jszip";
import type { DraftChapter } from "./split";

/**
 * Parse an EPUB entirely in the browser into clean chapter drafts. An EPUB is a
 * zip of XHTML documents in reading order (the "spine"), so this is just unzip +
 * read text — no OCR, no glyph repair. Already-clean source in, clean text out.
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

function htmlToChapter(html: string, index: number): DraftChapter {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((n) => n.remove());

  const heading = doc.querySelector("h1, h2, h3, title");
  const titleAr = (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
  // Drop the heading from the body so the title isn't duplicated in the text.
  if (heading && /^H[1-3]$/.test(heading.tagName)) heading.remove();

  // Mark block boundaries with newlines so paragraphs survive textContent.
  doc
    .querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, br, tr, blockquote, section")
    .forEach((el) => el.append("\n"));

  const contentAr = (doc.body?.textContent ?? "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    titleAr: titleAr || `الفصل ${index + 1}`,
    titleEn: `Chapter ${index + 1}`,
    contentAr,
  };
}

export async function parseEpub(file: File): Promise<DraftChapter[]> {
  const zip = await JSZip.loadAsync(file);

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Not a valid EPUB (missing META-INF/container.xml).");
  const container = new DOMParser().parseFromString(
    await containerFile.async("string"),
    "application/xml",
  );
  const opfPath = container
    .getElementsByTagNameNS("*", "rootfile")[0]
    ?.getAttribute("full-path");
  if (!opfPath) throw new Error("Could not locate the EPUB package file.");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("EPUB package file is missing.");
  const opf = new DOMParser().parseFromString(await opfFile.async("string"), "application/xml");
  const opfDir = dirname(opfPath);

  const manifest: Record<string, { href: string; type: string }> = {};
  const items = opf.getElementsByTagNameNS("*", "item");
  for (let i = 0; i < items.length; i++) {
    const id = items[i].getAttribute("id");
    const href = items[i].getAttribute("href");
    if (id && href) manifest[id] = { href, type: items[i].getAttribute("media-type") ?? "" };
  }

  const itemrefs = opf.getElementsByTagNameNS("*", "itemref");
  const chapters: DraftChapter[] = [];
  let n = 0;
  for (let i = 0; i < itemrefs.length; i++) {
    const idref = itemrefs[i].getAttribute("idref");
    if (!idref) continue;
    const item = manifest[idref];
    if (!item) continue;
    if (item.type && !item.type.includes("html")) continue;
    const file = zip.file(resolvePath(opfDir, item.href));
    if (!file) continue;
    const chapter = htmlToChapter(await file.async("string"), n);
    if (chapter.contentAr.length > 0) {
      chapters.push(chapter);
      n++;
    }
  }

  if (chapters.length === 0) throw new Error("No readable text found in this EPUB.");
  return chapters;
}
