"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { submitAttemptCore } from "@/server/core/tests";
import type { SubmitResult } from "./test-types";

export async function submitAttempt(
  testId: string,
  bookId: string,
  bookSlug: string,
  answers: Record<string, string>,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const result = await submitAttemptCore(
    { id: user.id, email: user.email ?? null },
    testId,
    bookId,
    answers,
  );
  if ("ok" in result) {
    revalidatePath(`/book/${bookSlug}`);
    revalidatePath("/path");
  }
  return result;
}
