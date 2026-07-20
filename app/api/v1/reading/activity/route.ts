import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { creditReadingActivityCore } from "@/server/core/chapters";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { chapterId?: string };
    await creditReadingActivityCore(user, body.chapterId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
