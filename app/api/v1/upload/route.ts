import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { isAdmin } from "@/lib/admin";
import { isPro } from "@/lib/entitlement";
import { parseEpubServer } from "@/lib/books/epub-server";
import { splitIntoChapters } from "@/lib/books/split";
import { slugify } from "@/lib/utils";
import {
  analyzeBookDraftCore,
  createBookWithChaptersCore,
  type Genre,
  type Uploader,
} from "@/server/core/books";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 30 * 1024 * 1024;

/**
 * One-shot book import for the mobile app: multipart form with `file`
 * (.epub or .txt) and optional `titleAr`/`titleEn`. Parses server-side,
 * runs the AI analyzer to place the book (level/genre/difficulty/blurb),
 * and creates the private book with chapters. Returns { slug }.
 */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  // Same gate as web /upload: bringing your own books is Pro (admins exempt).
  const admin = isAdmin(user.email);
  if (!admin && !(await isPro(user.id, user.email))) {
    return NextResponse.json(
      { error: "Uploading your own books is a Pro feature." },
      { status: 403 },
    );
  }
  const uploader: Uploader = { userId: user.id, isAdmin: admin };

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is larger than 30 MB." }, { status: 400 });
    }

    const isEpub = /\.epub$/i.test(file.name);
    let titleHint = String(form.get("titleAr") ?? "").trim();
    let authorHint: string | null = null;
    let chapters;
    if (isEpub) {
      const parsed = await parseEpubServer(await file.arrayBuffer());
      chapters = parsed.chapters;
      titleHint = titleHint || parsed.titleHint;
      authorHint = parsed.authorHint;
    } else {
      const text = await file.text();
      chapters = splitIntoChapters(text, { mode: "heading" });
    }
    if (!chapters || chapters.length === 0) {
      return NextResponse.json({ error: "Couldn't find chapters in that file." }, { status: 400 });
    }
    if (!titleHint) titleHint = file.name.replace(/\.[^.]+$/, "");

    // Let Claude place the book on the path; fall back to sane defaults if the
    // analyzer fails so an import never dies at the last step.
    let level = 4;
    let genre: Genre = "arabic_literature";
    let difficulty = 3;
    let blurb = "Imported book.";
    try {
      const analysis = await analyzeBookDraftCore(uploader, titleHint, chapters);
      level = analysis.level ?? level;
      genre = (analysis.genre as Genre) ?? genre;
      difficulty = analysis.difficulty ?? difficulty;
      blurb = analysis.blurb_en || blurb;
    } catch (err) {
      // Quota errors should stop the import (it's the metered feature)...
      const message = err instanceof Error ? err.message : "";
      if (/limit|pro feature/i.test(message)) throw err;
      // ...anything else falls back to defaults.
      console.error("[upload] analyze failed, using defaults:", err);
    }

    const titleEn = String(form.get("titleEn") ?? "").trim() || titleHint;
    const input = {
      slug: slugify(titleEn) || `import-${Date.now()}`,
      level,
      titleAr: titleHint,
      titleEn,
      authorAr: authorHint ?? undefined,
      blurb,
      difficulty,
      genre,
    };
    let result;
    try {
      result = await createBookWithChaptersCore(uploader, input, chapters);
    } catch (err) {
      // Re-importing the same title shouldn't dead-end on the slug.
      if (err instanceof Error && /already exists/.test(err.message)) {
        result = await createBookWithChaptersCore(
          uploader,
          { ...input, slug: `${input.slug}-${Date.now() % 100000}` },
          chapters,
        );
      } else {
        throw err;
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
