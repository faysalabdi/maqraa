import { after } from "next/server";
import { NextResponse } from "next/server";
import { internalSecret, runExtractionBatch } from "@/lib/texts/extract-job";

export const dynamic = "force-dynamic";
// One batch of chunks must finish inside this budget; the job chains to a fresh
// invocation for the next batch, so total extraction time is unbounded.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (req.headers.get("x-internal-secret") !== internalSecret()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let textId: string | undefined;
  try {
    ({ textId } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!textId) return NextResponse.json({ error: "textId required" }, { status: 400 });

  // Respond immediately; do the slow batch work after the response is flushed.
  after(async () => {
    try {
      await runExtractionBatch(textId!);
    } catch (e) {
      console.error("[extract] batch failed", textId, e);
    }
  });

  return NextResponse.json({ ok: true });
}
