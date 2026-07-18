import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { deleteAccountCore } from "@/server/core/account";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    await deleteAccountCore(user);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
