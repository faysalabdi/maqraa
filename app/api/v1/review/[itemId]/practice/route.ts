import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { practiceCardCore } from "@/server/core/review";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { itemId } = await params;
    const result = await practiceCardCore(user, itemId);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
