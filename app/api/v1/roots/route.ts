import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { rootsCore } from "@/server/core/roots";

export const dynamic = "force-dynamic";

/**
 * GET returns whatever families are already known without spending anything,
 * so opening the screen is free. POST pays for a batch of new analysis.
 */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    return NextResponse.json(await rootsCore(user, false));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    return NextResponse.json(await rootsCore(user, true));
  } catch (err) {
    return errorResponse(err);
  }
}
