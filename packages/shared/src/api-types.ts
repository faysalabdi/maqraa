/**
 * Wire types for the `/api/v1/*` endpoints — the single contract between the
 * Next.js API routes and the mobile client.
 */

export type ApiError = { error: string };

export type MeResponse = {
  id: string;
  email: string | null;
  plan: "free" | "pro";
  isAdmin: boolean;
};

export type PdfImportProgress = {
  stage: number | null;
  chunkDone: number | null;
  chunkTotal: number | null;
  lastLine: string;
};

/** GET /api/v1/admin/pdf-import/[jobId] */
export type PdfImportStatus = {
  status: "queued" | "running" | "done" | "failed";
  slug?: string;
  runUrl?: string;
  error?: string;
  progress?: PdfImportProgress | null;
};

export type WordLookupResponse = {
  lemma_ar: string;
  gloss_en: string;
  pos: string | null;
  example_ar: string | null;
  cached?: boolean;
};

export type SaveWordRequest = {
  lemmaAr: string;
  glossEn: string;
  exampleAr?: string | null;
  bookSlug?: string;
  chapterNumber?: number;
  surfaceKey?: string;
};

export type SaveWordResponse = { saved: boolean };
export type UnsaveWordResponse = { removed: boolean };

export type ChapterQuizResponse = {
  questions: { id: string; prompt_ar: string; choices: string[] }[];
};

export type ChapterQuizSubmitResponse = {
  score: number;
  correctCount: number;
  total: number;
  perQuestion: { id: string; correct: boolean; answerIndex: number; rationaleAr: string }[];
};

export type PublicQuestion = {
  id: string;
  type: "mcq" | "short" | "vocab" | "event";
  prompt_ar: string;
  choices?: string[];
  vocab_lemma?: string | null;
};

export type StartTestResponse = {
  ok: true;
  testId: string;
  questions: PublicQuestion[];
  isFallback: boolean;
  passageAr?: string;
};

export type PerQuestionResult = {
  id: string;
  type: string;
  prompt_ar: string;
  userAnswer: string;
  correctAnswer: string;
  rationale_ar: string;
  score: number; // 0..1
  feedback_ar: string;
  vocab_lemma?: string | null;
};

export type SubmitTestResponse = {
  ok: true;
  score: number; // 0..100
  passed: boolean;
  xpEarned: number;
  perQuestion: PerQuestionResult[];
  newLevel: number | null;
};

export type GradeCardResponse = {
  ok: true;
  xpEarned: number;
  graduated: boolean;
  nextDueAt: string;
};

export type PracticeCardResponse = { ok: true; xpEarned: number };

export type EarnedBadge = {
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  xpReward: number;
};

export type AchievementsSyncResponse = { earned: EarnedBadge[] };

export type RealtimeSessionResponse = {
  clientSecret: string;
  model: string;
  plan: "free" | "pro";
  maxSeconds: number;
};

export type LeaderRow = {
  userId: string;
  name: string;
  avatar: string | null;
  xp: number;
  streak: number;
  isYou: boolean;
};

export type LeaderboardResponse = {
  scope: "week" | "all";
  rows: LeaderRow[];
  you: (LeaderRow & { rank: number }) | null;
};
