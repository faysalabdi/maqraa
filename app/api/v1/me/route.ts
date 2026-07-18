import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { getPlan } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const plan = await getPlan(user.id, user.email);
    return NextResponse.json({ id: user.id, email: user.email, plan });
  } catch (err) {
    return errorResponse(err);
  }
}
