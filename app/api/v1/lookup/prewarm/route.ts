import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { prewarmLookupsCore } from "@/server/core/vocab";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { items } = (await req.json()) as {
      items?: { surface: string; context: string }[];
    };
    await prewarmLookupsCore(user, Array.isArray(items) ? items : []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
