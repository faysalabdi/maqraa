import { translateParagraphs } from "@/lib/ai/translate";
import type { CoreUser } from "./user";

export type TranslatePageResult = { translations: string[] };

/** Translate the paragraphs of one reader page. Shared by the action and route. */
export async function translatePageCore(
  user: CoreUser,
  paragraphs: string[],
): Promise<TranslatePageResult> {
  const cleaned = paragraphs
    .map((p) => p.trim())
    // A paragraph longer than this is almost certainly a parsing artefact
    // rather than prose, and would dominate the batch.
    .map((p) => p.slice(0, 4000))
    .filter(Boolean);
  const translations = await translateParagraphs(cleaned, user.id, user.email);
  return { translations };
}
