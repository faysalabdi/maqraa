import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPdfImport } from "@/lib/import/github";

export const dynamic = "force-dynamic";

const BUCKET = "pdf-imports";
const GENRES = ["islamic", "arabic_literature", "translated", "graded_reader", "classical"] as const;
const JOB_ID_RE = /^pdf-\d+-[a-z0-9-]{1,80}$/;

/**
 * Step 2 of the admin PDF import. The client has already uploaded the PDF to
 * Storage via the signed URL from /admin/pdf-import/sign (which keeps the file
 * off the 4.5 MB-capped API path). Given { jobId } + metadata, sign a
 * short-lived download URL and dispatch the import-pdf workflow — the CLI
 * pipeline then runs against production. Returns { jobId, slug }; poll
 * GET .../pdf-import/[jobId].
 */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

    const jobId = String(body.jobId ?? "");
    if (!JOB_ID_RE.test(jobId)) {
      return NextResponse.json({ error: "bad jobId" }, { status: 400 });
    }
    const slug = jobId.replace(/^pdf-\d+-/, "");
    const path = `${jobId}.pdf`;

    const str = (key: string) => String(body[key] ?? "").trim();
    const titleAr = str("titleAr");
    const titleEn = str("titleEn");
    if (!titleAr || !titleEn) {
      return NextResponse.json({ error: "Arabic and English titles are required." }, { status: 400 });
    }
    const level = Math.min(8, Math.max(1, Number(body.level) || 3));
    const difficulty = Math.min(5, Math.max(1, Number(body.difficulty) || 3));
    const genreRaw = str("genre") || "classical";
    const genre = (GENRES as readonly string[]).includes(genreRaw) ? genreRaw : "classical";
    const forceOcr = body.forceOcr === true || body.forceOcr === "true";

    const supabase = createAdminClient();
    // Confirm the client actually uploaded before spending a workflow run.
    const { data: listed } = await supabase.storage.from(BUCKET).list("", { search: `${jobId}.pdf` });
    if (!listed?.some((o) => o.name === `${jobId}.pdf`)) {
      return NextResponse.json({ error: "PDF wasn't uploaded — pick the file and try again." }, { status: 400 });
    }
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
      forceOcr,
    });

    return NextResponse.json({ jobId, slug });
  } catch (err) {
    return errorResponse(err);
  }
}
