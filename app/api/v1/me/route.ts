import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { getPlan } from "@/lib/entitlement";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const plan = await getPlan(user.id, user.email);
    return NextResponse.json({ id: user.id, email: user.email, plan, isAdmin: isAdmin(user.email) });
  } catch (err) {
    return errorResponse(err);
  }
}
