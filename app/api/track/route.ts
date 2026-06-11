import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";

const Body = z.object({
  event: z.string().min(1).max(64),
  path: z.string().max(256).optional(),
  props: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
    await logEvent(parsed.data.event, parsed.data.props, parsed.data.path);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
