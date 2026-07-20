import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPdfImport } from "@/lib/import/github";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Supabase's free-tier storage caps single files at 50 MB.
const MAX_BYTES = 45 * 1024 * 1024;
const BUCKET = "pdf-imports";
const GENRES = ["islamic", "arabic_literature", "translated", "graded_reader", "classical"] as const;

/**
 * Admin-only PDF import into the curated catalogue. Stores the PDF in
 * Supabase Storage, then dispatches the import-pdf GitHub Actions workflow,
 * which runs the real CLI pipeline (Python extractor + Claude) against the
 * production DB. Returns { jobId, slug } — poll GET .../pdf-import/[jobId].
 */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (!/\.pdf$/i.test(file.name)) {
      return NextResponse.json({ error: "Pick a .pdf file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is larger than 45 MB — import it with the CLI instead." },
        { status: 400 },
      );
    }

    const str = (key: string) => String(form.get(key) ?? "").trim();
    const titleAr = str("titleAr");
    const titleEn = str("titleEn");
    const slug = slugify(str("slug") || titleEn);
    if (!titleAr || !titleEn) {
      return NextResponse.json({ error: "Arabic and English titles are required." }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json(
        { error: "slug needs Latin letters or numbers — it becomes /book/<slug>." },
        { status: 400 },
      );
    }
    const level = Math.min(8, Math.max(1, Number(str("level")) || 3));
    const difficulty = Math.min(5, Math.max(1, Number(str("difficulty")) || 3));
    const genreRaw = str("genre") || "classical";
    const genre = (GENRES as readonly string[]).includes(genreRaw) ? genreRaw : "classical";

    const jobId = `pdf-${Date.now()}-${slug}`;
    const supabase = createAdminClient();
    // Created once; "already exists" just means a previous import made it.
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    const path = `${jobId}.pdf`;
    const upload = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: "application/pdf" });
    if (upload.error) throw new Error(`Storage upload failed: ${upload.error.message}`);
    // The runner downloads within minutes; an hour is generous.
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signed.error) throw new Error(`Signed URL failed: ${signed.error.message}`);

    await dispatchPdfImport({
      jobId,
      pdfUrl: signed.data.signedUrl,
      slug,
      titleAr,
      titleEn,
      authorAr: str("authorAr") || undefined,
      authorEn: str("authorEn") || undefined,
      level,
      genre,
      difficulty,
      blurb: str("blurb") || undefined,
      guidance: str("guidance") || undefined,
      forceOcr: str("forceOcr") === "true",
    });

    return NextResponse.json({ jobId, slug });
  } catch (err) {
    return errorResponse(err);
  }
}
