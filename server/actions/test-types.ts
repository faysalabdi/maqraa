// Shared types for comprehension test actions — no "use server"

export type PublicQuestion = {
  id: string;
  type: "mcq" | "short" | "vocab" | "event";
  prompt_ar: string;
  choices?: string[];
  vocab_lemma?: string | null;
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

export type StartTestResult =
  | {
      ok: true;
      testId: string;
      questions: PublicQuestion[];
      isFallback: boolean;
      passageAr?: string;
    }
  | { error: string };

export type SubmitResult =
  | {
      ok: true;
      score: number; // 0..100
      passed: boolean;
      xpEarned: number;
      perQuestion: PerQuestionResult[];
      newLevel: number | null;
    }
  | { error: string };
