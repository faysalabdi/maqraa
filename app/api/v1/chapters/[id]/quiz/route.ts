import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { getChapterQuizCore, submitChapterQuizCore } from "@/server/core/chapters";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const quiz = await getChapterQuizCore(user, id);
    return NextResponse.json(quiz);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const { answers } = (await req.json()) as { answers?: Record<string, number> };
    const result = await submitChapterQuizCore(user, id, answers ?? {});
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
