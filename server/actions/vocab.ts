"use server";

import { createClient } from "@/lib/supabase/server";
import { type WordLookup } from "@/lib/ai/word-lookup";
import {
  cachedLookupsCore,
  lookupWordCore,
  prewarmLookupsCore,
  saveWordCore,
  unsaveWordCore,
  type CachedLookup,
  type SaveWordInput,
} from "@/server/core/vocab";

export type { CachedLookup };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { id: user.id, email: user.email ?? null };
}

export async function lookupWord(surface: string, context: string): Promise<WordLookup> {
  const user = await requireUser();
  return lookupWordCore(user, surface, context);
}

export async function prewarmLookups(items: { surface: string; context: string }[]): Promise<void> {
  const user = await requireUser();
  return prewarmLookupsCore(user, items);
}

export async function cachedLookups(keys: string[]): Promise<Record<string, CachedLookup>> {
  await requireUser();
  return cachedLookupsCore(keys);
}

export async function saveWord(input: SaveWordInput): Promise<{ saved: boolean }> {
  const user = await requireUser();
  return saveWordCore(user, input);
}

export async function unsaveWord(lemmaAr: string): Promise<{ removed: boolean }> {
  const user = await requireUser();
  return unsaveWordCore(user, lemmaAr);
}
