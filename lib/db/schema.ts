import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  smallint,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ────────────────────────────── enums ────────────────────────────── */

export const bookStatus = pgEnum("book_status", [
  "locked",
  "unlocked",
  "in_progress",
  "reading_done",
  "testing",
  "completed",
  "failed_retry",
]);

export const vocabSource = pgEnum("vocab_source", ["test_wrong", "reading_flag", "manual"]);

export const xpReason = pgEnum("xp_reason", [
  "page_logged",
  "minute_logged",
  "vocab_learned",
  "test_passed",
  "perfect_score",
  "streak_day",
  "srs_review",
  "book_completed",
  "level_up",
  "achievement",
  "conversation_turn",
  "listening_passed",
]);

export const bookGenre = pgEnum("book_genre", [
  "islamic",
  "arabic_literature",
  "translated",
  "graded_reader",
  "classical",
]);

export const chapterStatus = pgEnum("chapter_status", ["unread", "reading", "completed"]);

/* ────────────────────────────── catalogue ────────────────────────────── */

export const levels = pgTable("levels", {
  level: integer("level").primaryKey(), // 1..8
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description").notNull(),
  booksRequiredToClear: integer("books_required_to_clear").notNull(),
});

export const books = pgTable(
  "books",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    level: integer("level")
      .notNull()
      .references(() => levels.level),
    orderInLevel: integer("order_in_level").notNull(),
    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    authorAr: text("author_ar"),
    authorEn: text("author_en"),
    blurb: text("blurb").notNull(),
    coverUrl: text("cover_url"),
    // null = curated public catalogue book; otherwise the user who uploaded it
    // (private to them). Public read = owner_id is null or owner_id = auth.uid().
    ownerId: uuid("owner_id"),
    difficulty: smallint("difficulty").notNull().default(1), // 1..5 within level
    genre: bookGenre("genre").notNull().default("islamic"),
    isSelection: boolean("is_selection").notNull().default(false),
    parentBookId: uuid("parent_book_id"),
    recommendedPages: integer("recommended_pages"),
    hasFullText: boolean("has_full_text").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    levelOrderIdx: uniqueIndex("books_level_order_idx").on(t.level, t.orderInLevel),
  }),
);

export const achievements = pgTable("achievements", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  xpReward: integer("xp_reward").notNull().default(0),
  criteria: jsonb("criteria").notNull(),
});

/* ────────────────────────────── per-user ────────────────────────────── */

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name"),
  currentLevel: integer("current_level").notNull().default(1),
  xpTotal: integer("xp_total").notNull().default(0),
  dailyXpGoal: integer("daily_xp_goal").notNull().default(50),
  fontScale: numeric("font_scale", { precision: 3, scale: 2 }).notNull().default("1.00"),
  prefersRtl: boolean("prefers_rtl").notNull().default(true),
  streakFreezes: integer("streak_freezes").notNull().default(2),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userBooks = pgTable(
  "user_books",
  {
    userId: uuid("user_id").notNull(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    status: bookStatus("status").notNull().default("unlocked"),
    pagesRead: integer("pages_read").notNull().default(0),
    minutesRead: integer("minutes_read").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    bestScore: numeric("best_score", { precision: 5, scale: 2 }),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.bookId] }),
    statusIdx: index("user_books_user_status_idx").on(t.userId, t.status),
  }),
);

export const readingSessions = pgTable(
  "reading_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    pages: integer("pages").notNull().default(0),
    minutes: integer("minutes").notNull().default(0),
    note: text("note"),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userReadAtIdx: index("reading_sessions_user_readat_idx").on(t.userId, t.readAt),
  }),
);

export const comprehensionTests = pgTable(
  "comprehension_tests",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    userId: uuid("user_id").notNull(), // who triggered generation
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    questions: jsonb("questions").notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    isFallback: boolean("is_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bookCreatedIdx: index("tests_book_created_idx").on(t.bookId, t.createdAt),
  }),
);

export const comprehensionAttempts = pgTable(
  "comprehension_attempts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    testId: uuid("test_id")
      .notNull()
      .references(() => comprehensionTests.id),
    userId: uuid("user_id").notNull(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    answers: jsonb("answers").notNull(),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    passed: boolean("passed").notNull(),
    perQuestion: jsonb("per_question").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSubmittedIdx: index("attempts_user_submitted_idx").on(t.userId, t.submittedAt),
  }),
);

export const vocabItems = pgTable(
  "vocab_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    lemmaAr: text("lemma_ar").notNull(),
    glossEn: text("gloss_en").notNull(),
    exampleAr: text("example_ar"),
    source: vocabSource("source").notNull(),
    sourceRef: jsonb("source_ref"),
    ease: numeric("ease", { precision: 4, scale: 2 }).notNull().default("2.50"),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    lapses: integer("lapses").notNull().default(0),
    suspended: boolean("suspended").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDueIdx: index("vocab_user_due_idx").on(t.userId, t.dueAt),
    userLemmaIdx: uniqueIndex("vocab_user_lemma_idx").on(t.userId, t.lemmaAr),
  }),
);

export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    delta: integer("delta").notNull(),
    reason: xpReason("reason").notNull(),
    ref: jsonb("ref"),
    refHash: text("ref_hash"), // for idempotency
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userOccurredIdx: index("xp_user_occurred_idx").on(t.userId, t.occurredAt),
    userReasonRefIdx: uniqueIndex("xp_user_reason_ref_idx").on(t.userId, t.reason, t.refHash),
  }),
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id").notNull(),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.achievementId] }),
  }),
);

export const bookChapters = pgTable(
  "book_chapters",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    chapterNumber: integer("chapter_number").notNull(),
    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    contentAr: text("content_ar").notNull(),
    source: text("source").notNull().default("public_domain"), // public_domain | original
  },
  (t) => ({
    bookChapterIdx: uniqueIndex("chapters_book_number_idx").on(t.bookId, t.chapterNumber),
  }),
);

export const userChapterProgress = pgTable(
  "user_chapter_progress",
  {
    userId: uuid("user_id").notNull(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => bookChapters.id),
    status: chapterStatus("status").notNull().default("unread"),
    quizScore: numeric("quiz_score", { precision: 5, scale: 2 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.chapterId] }),
  }),
);

export const chapterQuizzes = pgTable("chapter_quizzes", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  chapterId: uuid("chapter_id")
    .notNull()
    .unique()
    .references(() => bookChapters.id),
  model: text("model").notNull(),
  questions: jsonb("questions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Global (not per-user) cache of Claude word lookups, keyed by diacritic-stripped surface.
export const wordLookups = pgTable("word_lookups", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  surface: text("surface").notNull(),
  lemmaAr: text("lemma_ar").notNull(),
  glossEn: text("gloss_en").notNull(),
  pos: text("pos"),
  exampleAr: text("example_ar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const streaks = pgTable("streaks", {
  userId: uuid("user_id").primaryKey(),
  currentDays: integer("current_days").notNull().default(0),
  longestDays: integer("longest_days").notNull().default(0),
  lastActiveDate: date("last_active_date"),
  freezesRemaining: integer("freezes_remaining").notNull().default(2),
});

/* ────────────────────────────── analytics ──────────────────────────────
 * Lightweight first-party usage tracking. One row per event. Aggregations
 * are done at read time in /admin/analytics or via raw SQL.
 */

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id"), // null = anonymous (pre-auth pages)
    sessionId: text("session_id"), // browser-stable opaque id (set in middleware)
    event: text("event").notNull(), // e.g. "page_view", "word_lookup", "quiz_submit"
    path: text("path"), // normalized URL path
    props: jsonb("props"), // arbitrary structured payload
    userAgent: text("user_agent"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userOccurredIdx: index("usage_user_occurred_idx").on(t.userId, t.occurredAt),
    eventOccurredIdx: index("usage_event_occurred_idx").on(t.event, t.occurredAt),
  }),
);

/* ──────────────────────── practice: conversation ──────────────────────── */

export const conversationSessions = pgTable(
  "conversation_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    scenario: text("scenario").notNull(), // slug, e.g. "market", "introductions"
    level: integer("level").notNull().default(1),
    // array of { role: "user" | "partner", content_ar, translation_en?, correction? }
    messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
    turns: integer("turns").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUpdatedIdx: index("conversations_user_updated_idx").on(t.userId, t.updatedAt),
  }),
);

/* ───────────────────────── practice: listening ───────────────────────── */

// Global pool of generated listening exercises, shared across users per level.
export const listeningExercises = pgTable(
  "listening_exercises",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    level: integer("level").notNull(),
    topic: text("topic").notNull(),
    passageAr: text("passage_ar").notNull(),
    questions: jsonb("questions").notNull(), // [{id, prompt_ar, choices[4], answer_index, rationale_ar}]
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    levelIdx: index("listening_level_idx").on(t.level),
  }),
);
