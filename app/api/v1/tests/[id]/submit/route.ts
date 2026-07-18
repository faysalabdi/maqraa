import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { submitAttemptCore } from "@/server/core/tests";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const { bookId, answers } = (await req.json()) as {
      bookId?: string;
      answers?: Record<string, string>;
    };
    if (!bookId) return NextResponse.json({ error: "bookId required" }, { status: 400 });
    const result = await submitAttemptCore(user, id, bookId, answers ?? {});
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
