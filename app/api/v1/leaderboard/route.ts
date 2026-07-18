import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { getLeaderboard } from "@/server/core/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "week";
    const result = await getLeaderboard(user, scope);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
