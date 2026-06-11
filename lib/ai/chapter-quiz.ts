import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, FALLBACK_MODEL } from "./anthropic";

export const ChapterQuestionSchema = z.object({
  id: z.string(),
  prompt_ar: z.string(),
  choices: z.array(z.string()).length(4),
  answer_index: z.number().int().min(0).max(3),
  rationale_ar: z.string(),
});

export const ChapterQuizSchema = z.object({
  questions: z.array(ChapterQuestionSchema).length(4),
});

export type ChapterQuiz = z.infer<typeof ChapterQuizSchema>;

const SUBMIT_QUIZ_TOOL = {
  name: "submit_quiz",
  description: "Submit the 4-question comprehension quiz for the chapter.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            prompt_ar: { type: "string" },
            choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            answer_index: { type: "integer", minimum: 0, maximum: 3 },
            rationale_ar: { type: "string" },
          },
          required: ["id", "prompt_ar", "choices", "answer_index", "rationale_ar"],
        },
      },
    },
    required: ["questions"],
  },
} as const;

export async function getOrGenerateChapterQuiz(
  chapterId: string,
  contentAr: string,
  level: number,
): Promise<ChapterQuiz> {
  const cached = await db
    .select()
    .from(schema.chapterQuizzes)
    .where(eq(schema.chapterQuizzes.chapterId, chapterId))
    .limit(1);
  if (cached[0]) {
    return ChapterQuizSchema.parse(cached[0].questions);
  }

  const response = await anthropic.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: "You are an Arabic comprehension examiner. You will receive the full Arabic text of a chapter the learner just read, plus their level (1-8). Generate exactly 4 multiple-choice questions in clear Modern Standard Arabic testing understanding of THIS chapter only: key events, meanings, and one vocabulary-in-context question. Add tashkeel to uncommon words. Each question has 4 distinct choices with exactly one correct. Calibrate wording to the learner's level. Submit only via the submit_quiz tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_QUIZ_TOOL as never],
    tool_choice: { type: "tool", name: "submit_quiz" },
    messages: [
      {
        role: "user",
        content: `Learner level: ${level} of 8\n\nChapter text:\n${contentAr}`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no tool_use in quiz response");

  const quiz = ChapterQuizSchema.parse(toolUse.input);

  await db
    .insert(schema.chapterQuizzes)
    .values({ chapterId, model: FALLBACK_MODEL, questions: quiz })
    .onConflictDoNothing();

  return quiz;
}
