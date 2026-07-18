import { NextResponse } from "next/server";

/** Map a thrown core error to a JSON response. Quota/limit errors get 429. */
export function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Something went wrong.";
  const status = /limit|upgrade to pro/i.test(message) ? 429 : 400;
  return NextResponse.json({ error: message }, { status });
}
