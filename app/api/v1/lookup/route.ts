import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { lookupWordCore } from "@/server/core/vocab";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { surface, context } = (await req.json()) as { surface?: string; context?: string };
    if (!surface) return NextResponse.json({ error: "surface required" }, { status: 400 });
    const lookup = await lookupWordCore(user, surface, context ?? "");
    return NextResponse.json(lookup);
  } catch (err) {
    return errorResponse(err);
  }
}
