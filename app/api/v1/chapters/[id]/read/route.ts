import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { markChapterReadCore, markChapterReadingCore } from "@/server/core/chapters";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Body `{ status: "reading" }` marks the chapter opened; default marks it read. */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { status?: string };
    if (body.status === "reading") {
      await markChapterReadingCore(user, id);
    } else {
      await markChapterReadCore(user, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
