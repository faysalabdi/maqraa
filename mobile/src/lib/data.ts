import { supabase } from "./supabase";

/** Catalogue + per-user reads that go straight to Supabase under RLS. */

export type Book = {
  id: string;
  slug: string;
  level: number;
  order_in_level: number;
  title_ar: string;
  title_en: string;
  author_ar: string | null;
  author_en: string | null;
  blurb: string;
  cover_url: string | null;
  difficulty: number;
  genre: string;
  recommended_pages: number | null;
  has_full_text: boolean;
  owner_id: string | null;
};

export type UserBook = {
  book_id: string;
  status: string;
  best_score: string | null;
  attempts: number;
  updated_at: string;
};

export type ChapterMeta = {
  id: string;
  book_id: string;
  chapter_number: number;
  title_ar: string;
  title_en: string;
};

export type Chapter = ChapterMeta & { content_ar: string };

export type ChapterProgress = {
  chapter_id: string;
  status: string;
  quiz_score: string | null;
};

export type CachedLookupRow = {
  key: string;
  lemma_ar: string;
  gloss_en: string;
  pos: string | null;
  example_ar: string | null;
};

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchCatalogue(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, slug, level, order_in_level, title_ar, title_en, author_ar, author_en, blurb, cover_url, difficulty, genre, recommended_pages, has_full_text, owner_id",
    )
    .is("owner_id", null)
    .eq("has_full_text", true)
    .order("level")
    .order("order_in_level");
  throwIf(error);
  return (data ?? []) as Book[];
}

export async function fetchUserBooks(): Promise<UserBook[]> {
  const { data, error } = await supabase
    .from("user_books")
    .select("book_id, status, best_score, attempts, updated_at");
  throwIf(error);
  return (data ?? []) as UserBook[];
}

export async function fetchBookBySlug(slug: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, slug, level, order_in_level, title_ar, title_en, author_ar, author_en, blurb, cover_url, difficulty, genre, recommended_pages, has_full_text, owner_id",
    )
    .eq("slug", slug)
    .maybeSingle();
  throwIf(error);
  return data as Book | null;
}

export async function fetchChapterMetas(bookId: string): Promise<ChapterMeta[]> {
  const { data, error } = await supabase
    .from("book_chapters")
    .select("id, book_id, chapter_number, title_ar, title_en")
    .eq("book_id", bookId)
    .order("chapter_number");
  throwIf(error);
  return (data ?? []) as ChapterMeta[];
}

export async function fetchChapter(
  bookId: string,
  chapterNumber: number,
): Promise<Chapter | null> {
  const { data, error } = await supabase
    .from("book_chapters")
    .select("id, book_id, chapter_number, title_ar, title_en, content_ar")
    .eq("book_id", bookId)
    .eq("chapter_number", chapterNumber)
    .maybeSingle();
  throwIf(error);
  return data as Chapter | null;
}

export async function fetchChapterProgress(chapterIds: string[]): Promise<ChapterProgress[]> {
  if (chapterIds.length === 0) return [];
  const { data, error } = await supabase
    .from("user_chapter_progress")
    .select("chapter_id, status, quiz_score")
    .in("chapter_id", chapterIds);
  throwIf(error);
  return (data ?? []) as ChapterProgress[];
}

/** Global lookup cache — read-only warm so taps on known words are instant. */
export async function fetchCachedLookups(keys: string[]): Promise<Record<string, CachedLookupRow>> {
  const uniq = [...new Set(keys.filter(Boolean))].slice(0, 400);
  if (uniq.length === 0) return {};
  const { data, error } = await supabase
    .from("word_lookups")
    .select("key, lemma_ar, gloss_en, pos, example_ar")
    .in("key", uniq);
  throwIf(error);
  const out: Record<string, CachedLookupRow> = {};
  for (const row of (data ?? []) as CachedLookupRow[]) out[row.key] = row;
  return out;
}

export async function deleteVocabItem(lemmaAr: string): Promise<void> {
  const { error } = await supabase.from("vocab_items").delete().eq("lemma_ar", lemmaAr);
  throwIf(error);
}
