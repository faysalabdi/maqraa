"use server";

import { createClient } from "@/lib/supabase/server";
import { deleteAccountCore } from "@/server/core/account";

/**
 * Permanently delete the current user: cancel any live subscription, remove all
 * of their data (including books they uploaded), then delete the auth user and
 * sign out. Irreversible.
 */
export async function deleteAccount(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  await deleteAccountCore({ id: user.id, email: user.email ?? null });
  await supabase.auth.signOut();
}
