import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { saveWordCore, unsaveWordCore, type SaveWordInput } from "@/server/core/vocab";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const input = (await req.json()) as SaveWordInput;
    const result = await saveWordCore(user, input);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { lemmaAr } = (await req.json()) as { lemmaAr?: string };
    if (!lemmaAr) return NextResponse.json({ error: "lemmaAr required" }, { status: 400 });
    const result = await unsaveWordCore(user, lemmaAr);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
