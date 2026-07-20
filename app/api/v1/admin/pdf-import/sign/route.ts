import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BUCKET = "pdf-imports";

/**
 * Step 1 of the admin PDF import: mint a signed URL the client uploads the PDF
 * straight to Supabase Storage with. This bypasses Vercel's ~4.5 MB function
 * body cap — a real book never passes through the API. Returns { jobId,
 * uploadUrl }; the client uploads, then POSTs metadata to /admin/pdf-import
 * with that jobId.
 */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { slug?: string };
    const slug = slugify(String(body.slug ?? ""));
    if (!slug) {
      return NextResponse.json(
        { error: "slug needs Latin letters or numbers — it becomes /book/<slug>." },
        { status: 400 },
      );
    }
    const jobId = `pdf-${Date.now()}-${slug}`;
    const path = `${jobId}.pdf`;
    const supabase = createAdminClient();
    // Created once; "already exists" just means a previous import made it.
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signed.error) throw new Error(`Signed upload URL failed: ${signed.error.message}`);
    return NextResponse.json({ jobId, uploadUrl: signed.data.signedUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
