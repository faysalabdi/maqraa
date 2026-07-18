import { NextResponse } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";

export type ApiUser = { id: string; email: string | null };

/**
 * Resolve the caller of an API route. Prefers a Bearer token (mobile app);
 * falls back to the web session cookie so the same routes work from both
 * clients. Returns null when neither yields a user.
 */
export async function getApiUser(req: Request): Promise<ApiUser | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) {
      const supabase = createBearerClient(token);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) return { id: user.id, email: user.email ?? null };
    }
    // An explicit-but-invalid token never falls back to cookies.
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}
