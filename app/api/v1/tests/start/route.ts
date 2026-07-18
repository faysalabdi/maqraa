import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { startTestCore } from "@/server/core/tests";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { bookSlug } = (await req.json()) as { bookSlug?: string };
    if (!bookSlug) return NextResponse.json({ error: "bookSlug required" }, { status: 400 });
    const result = await startTestCore(user, bookSlug);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
