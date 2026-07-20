import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { isAdmin } from "@/lib/admin";
import { db, schema } from "@/lib/db";
import { findImportRun, fetchRunLog } from "@/lib/import/github";
import { parseImportProgress } from "@/lib/import/progress";

export const dynamic = "force-dynamic";

const JOB_ID_RE = /^pdf-\d+-[a-z0-9-]{1,80}$/;

/**
 * Poll the state of a dispatched PDF import. The workflow run is found by its
 * `pdf-import:<jobId>` run-name; while it runs we tail the job log for the
 * CLI's [n/6] stage markers and chunk counters. Success is only reported once
 * the book row actually exists.
 */
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { jobId } = await params;
  if (!JOB_ID_RE.test(jobId)) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }
  const slug = jobId.replace(/^pdf-\d+-/, "");

  try {
    const run = await findImportRun(jobId);
    // Dispatched but not yet visible in the runs list — GitHub lag.
    if (!run) return NextResponse.json({ status: "queued" });

    if (run.status !== "completed") {
      const log = await fetchRunLog(run.id).catch(() => null);
      return NextResponse.json({
        status: run.status === "in_progress" ? "running" : "queued",
        progress: log ? parseImportProgress(log) : null,
        runUrl: run.htmlUrl,
      });
    }

    if (run.conclusion === "success") {
      const [book] = await db
        .select({ slug: schema.books.slug })
        .from(schema.books)
        .where(eq(schema.books.slug, slug))
        .limit(1);
      return NextResponse.json({ status: "done", slug: book?.slug ?? slug, runUrl: run.htmlUrl });
    }

    const log = await fetchRunLog(run.id).catch(() => null);
    const progress = log ? parseImportProgress(log) : null;
    return NextResponse.json({
      status: "failed",
      error: progress?.lastLine || `Import ${run.conclusion ?? "failed"}.`,
      runUrl: run.htmlUrl,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
