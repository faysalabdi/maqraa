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

export type VocabItem = {
  id: string;
  lemma_ar: string;
  gloss_en: string;
  example_ar: string | null;
  due_at: string;
  interval_days: number;
  repetitions: number;
  lapses: number;
  created_at: string;
};

export async function fetchVocab(): Promise<VocabItem[]> {
  const { data, error } = await supabase
    .from("vocab_items")
    .select("id, lemma_ar, gloss_en, example_ar, due_at, interval_days, repetitions, lapses, created_at")
    .order("created_at", { ascending: false });
  throwIf(error);
  return (data ?? []) as VocabItem[];
}

export type Profile = {
  id: string;
  display_name: string | null;
  current_level: number;
  xp_total: number;
  daily_xp_goal: number;
  font_scale: string;
};

export type Streak = {
  current_days: number;
  longest_days: number;
  last_active_date: string | null;
};

export type XpEvent = { delta: number; reason: string; occurred_at: string };

export type Achievement = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description: string;
  icon: string;
  xp_reward: number;
};

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, current_level, xp_total, daily_xp_goal, font_scale")
    .maybeSingle();
  throwIf(error);
  return data as Profile | null;
}

export async function fetchStreak(): Promise<Streak | null> {
  const { data, error } = await supabase
    .from("streaks")
    .select("current_days, longest_days, last_active_date")
    .maybeSingle();
  throwIf(error);
  return data as Streak | null;
}

export async function fetchRecentXp(days: number): Promise<XpEvent[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("xp_events")
    .select("delta, reason, occurred_at")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(500);
  throwIf(error);
  return (data ?? []) as XpEvent[];
}

export async function fetchCompletedBooksCount(): Promise<number> {
  const { count, error } = await supabase
    .from("user_books")
    .select("book_id", { count: "exact", head: true })
    .eq("status", "completed");
  throwIf(error);
  return count ?? 0;
}

export async function fetchAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("id, slug, name_en, name_ar, description, icon, xp_reward");
  throwIf(error);
  return (data ?? []) as Achievement[];
}

export async function fetchEarnedAchievementIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("user_achievements").select("achievement_id");
  throwIf(error);
  return new Set(((data ?? []) as { achievement_id: string }[]).map((r) => r.achievement_id));
}

export async function fetchDueVocab(): Promise<VocabItem[]> {
  const { data, error } = await supabase
    .from("vocab_items")
    .select("id, lemma_ar, gloss_en, example_ar, due_at, interval_days, repetitions, lapses, created_at")
    .lte("due_at", new Date().toISOString())
    .eq("suspended", false)
    .order("due_at")
    .limit(50);
  throwIf(error);
  return (data ?? []) as VocabItem[];
}
