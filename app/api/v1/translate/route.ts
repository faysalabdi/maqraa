import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { translatePageCore } from "@/server/core/translate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { paragraphs } = (await req.json()) as { paragraphs?: unknown };
    if (!Array.isArray(paragraphs) || paragraphs.some((p) => typeof p !== "string")) {
      return NextResponse.json({ error: "paragraphs must be an array of strings" }, { status: 400 });
    }
    return NextResponse.json(await translatePageCore(user, paragraphs as string[]));
  } catch (err) {
    return errorResponse(err);
  }
}
