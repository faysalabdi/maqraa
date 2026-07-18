import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncRevenueCatEvent, type RevenueCatEvent } from "@/lib/revenuecat/sync";

export const dynamic = "force-dynamic";

/**
 * RevenueCat server notifications. Configured in the RC dashboard with an
 * Authorization header value that must match REVENUECAT_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RevenueCat not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: RevenueCatEvent;
  try {
    const body = (await req.json()) as { event?: RevenueCatEvent };
    if (!body.event?.type || !body.event.app_user_id) throw new Error("malformed");
    event = body.event;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  try {
    const applied = await syncRevenueCatEvent(event);
    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    console.error("[revenuecat/webhook]", err);
    // 500 so RevenueCat retries.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
