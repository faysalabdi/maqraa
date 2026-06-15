import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** True if the email is on the comma-separated ADMIN_EMAILS allowlist. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email || !env.ADMIN_EMAILS) return false;
  return env.ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(email.toLowerCase());
}

/**
 * Assert the current request is from an admin. Returns the user. Throws
 * "forbidden" otherwise — server actions must call this before any write so the
 * gate never lives only in the UI.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) throw new Error("forbidden");
  return user!;
}
