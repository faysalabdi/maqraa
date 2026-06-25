import { and, count, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { isPro } from "@/lib/entitlement";

/** True if the email is on the comma-separated ADMIN_EMAILS allowlist. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email || !env.ADMIN_EMAILS) return false;
  return env.ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(email.toLowerCase());
}

/** How many books a user has finished — surfaced as a progress stat. */
export async function booksFinished(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.userBooks)
    .where(and(eq(schema.userBooks.userId, userId), eq(schema.userBooks.status, "completed")));
  return Number(row?.n ?? 0);
}

/**
 * Assert the current request may upload a book, and tell the caller whether
 * they are an admin (admins add public/curated books, everyone else's uploads
 * are private to them). Bringing your own books is a Pro feature. Throws
 * otherwise — the authoritative server-side gate.
 */
export async function requireUploader(): Promise<{ userId: string; isAdmin: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("forbidden");
  if (isAdmin(user.email)) return { userId: user.id, isAdmin: true };
  if (await isPro(user.id, user.email)) return { userId: user.id, isAdmin: false };
  throw new Error("Uploading your own books is a Pro feature.");
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
