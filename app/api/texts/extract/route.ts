import { after } from "next/server";
import { NextResponse } from "next/server";
import { internalSecret, runExtractionLoop } from "@/lib/texts/extract-job";

export const dynamic = "force-dynamic";
// Each invocation loops through batches until ~210s, then hands off to a fresh
// invocation, so total extraction time is unbounded while every single
// invocation stays inside this budget.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (req.headers.get("x-internal-secret") !== internalSecret()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let textId: string | undefined;
  let origin: string | undefined;
  try {
    ({ textId, origin } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!textId) return NextResponse.json({ error: "textId required" }, { status: 400 });

  // Respond immediately; do the slow batch work after the response is flushed.
  const resolvedOrigin = origin ?? new URL(req.url).origin;
  after(async () => {
    try {
      await runExtractionLoop(textId!, resolvedOrigin);
    } catch (e) {
      console.error("[extract] loop failed", textId, e);
    }
  });

  return NextResponse.json({ ok: true });
}
