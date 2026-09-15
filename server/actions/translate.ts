"use server";

import { createClient } from "@/lib/supabase/server";
import { translatePageCore } from "@/server/core/translate";

/** Translate the paragraphs of the page the reader is looking at. */
export async function translatePage(
  paragraphs: string[],
): Promise<{ translations: string[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  try {
    return await translatePageCore({ id: user.id, email: user.email ?? null }, paragraphs);
  } catch (err) {
    // Quota and upgrade prompts arrive as thrown messages worth showing.
    return { error: err instanceof Error ? err.message : "Translation failed." };
  }
}
