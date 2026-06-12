import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, FALLBACK_MODEL } from "./anthropic";

export const ListeningQuestionSchema = z.object({
  id: z.string(),
  prompt_ar: z.string(),
  choices: z.array(z.string()).length(4),
  answer_index: z.number().int().min(0).max(3),
  rationale_ar: z.string(),
});

export const ListeningExerciseSchema = z.object({
  topic: z.string(),
  passage_ar: z.string(),
  questions: z.array(ListeningQuestionSchema).length(3),
});

export type ListeningExercise = z.infer<typeof ListeningExerciseSchema> & { id: string };

const SUBMIT_TOOL = {
  name: "submit_listening",
  description: "Submit the listening exercise.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "2-4 word English topic label." },
      passage_ar: {
        type: "string",
        description:
          "A spoken-style Arabic passage to be read aloud by TTS: 60-120 words for levels 1-2, 100-180 for 3-4, 150-250 for 5+. Natural MSA, full tashkeel for levels 1-2 only. No headings.",
      },
      questions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
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
    required: ["topic", "passage_ar", "questions"],
  },
} as const;

const POOL_TARGET = 10;

/**
 * Returns a random cached exercise for the level, generating a new one when
 * the pool is small (so the pool grows organically with use).
 */
export async function getOrGenerateListeningExercise(level: number): Promise<ListeningExercise> {
  const pool = await db
    .select()
    .from(schema.listeningExercises)
    .where(eq(schema.listeningExercises.level, level))
    .orderBy(sql`random()`)
    .limit(POOL_TARGET);

  if (pool.length >= POOL_TARGET || (pool.length > 0 && Math.random() < 0.7)) {
    const pick = pool[0];
    return {
      id: pick.id,
      topic: pick.topic,
      passage_ar: pick.passageAr,
      questions: z.array(ListeningQuestionSchema).parse(pick.questions),
    };
  }

  const response = await anthropic.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: "You create Arabic listening-comprehension exercises. The passage will be read aloud by text-to-speech; the learner answers questions from listening alone. Write a self-contained passage (a short story, dialogue summary, news-style item, or everyday situation) calibrated to the learner's level, then 3 multiple-choice questions in Arabic about what was heard. Distinct choices, exactly one correct. Vary topics widely. Submit only via the submit_listening tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_TOOL as never],
    tool_choice: { type: "tool", name: "submit_listening" },
    messages: [
      {
        role: "user",
        content: `Learner level: ${level} of 8. Generate one fresh exercise on a topic you haven't used recently.`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no exercise returned");
  const parsed = ListeningExerciseSchema.parse(toolUse.input);

  const [row] = await db
    .insert(schema.listeningExercises)
    .values({
      level,
      topic: parsed.topic,
      passageAr: parsed.passage_ar,
      questions: parsed.questions,
      model: FALLBACK_MODEL,
    })
    .returning({ id: schema.listeningExercises.id });

  return { id: row.id, ...parsed };
}
