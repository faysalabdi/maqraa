import { and, count, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";

/** Books a reader must finish before bringing their own. */
export const UPLOAD_MIN_BOOKS = 2;

/** True if the email is on the comma-separated ADMIN_EMAILS allowlist. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email || !env.ADMIN_EMAILS) return false;
  return env.ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(email.toLowerCase());
}

/**
 * Uploading your own books unlocks once a reader has finished a couple of books.
 * Admins always have it. Pure check for UI gating.
 */
export function uploadUnlocked(email: string | null | undefined, booksFinished: number): boolean {
  return isAdmin(email) || booksFinished >= UPLOAD_MIN_BOOKS;
}

/** How many books a user has finished — the outcome that drives unlocks. */
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
 * are private to them). Throws otherwise — the authoritative server-side gate.
 */
export async function requireUploader(): Promise<{ userId: string; isAdmin: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("forbidden");
  if (isAdmin(user.email)) return { userId: user.id, isAdmin: true };
  if ((await booksFinished(user.id)) < UPLOAD_MIN_BOOKS)
    throw new Error(`Finish ${UPLOAD_MIN_BOOKS} books to unlock uploading your own books.`);
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
