"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  displayName: z.string().trim().max(80).optional().nullable(),
  fontScale: z.coerce.number().min(0.7).max(1.5),
});

export type UpdateSettingsInput = z.input<typeof InputSchema>;

export async function updateSettings(input: UpdateSettingsInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { displayName, fontScale } = parsed.data;

  await db
    .update(schema.profiles)
    .set({
      displayName: displayName?.trim() || null,
      fontScale: fontScale.toString(),
      updatedAt: new Date(),
    })
    .where(eq(schema.profiles.id, user.id));

  revalidatePath("/settings");
  revalidatePath("/path");
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true };
}
