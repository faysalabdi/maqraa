import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";

/** True if the email is on the comma-separated ADMIN_EMAILS allowlist. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email || !env.ADMIN_EMAILS) return false;
  return env.ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(email.toLowerCase());
}

/**
 * Uploading your own books unlocks once a reader clears Stage 1 (current level
 * advances past 1). Admins always have it. Pure check for UI gating.
 */
export function uploadUnlocked(email: string | null | undefined, currentLevel: number): boolean {
  return isAdmin(email) || currentLevel >= 2;
}

/**
 * Assert the current request may upload a book, and tell the caller whether
 * they are an admin (admins add public/curated books, everyone else's uploads
 * are private to them). Throws otherwise — the authoritative server-side gate.
 */
export async function requireUploader(): Promise<{ userId: string; isAdmin: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("forbidden");
  if (isAdmin(user.email)) return { userId: user.id, isAdmin: true };
  const [p] = await db
    .select({ lvl: schema.profiles.currentLevel })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);
  if ((p?.lvl ?? 1) < 2)
    throw new Error("Finish Stage 1 to unlock uploading your own books.");
  return { userId: user.id, isAdmin: false };
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
