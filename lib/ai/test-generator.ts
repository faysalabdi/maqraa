import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { anthropic, TEST_MODEL } from "./anthropic";

export const QUESTION_TYPES = ["mcq", "short", "vocab", "event"] as const;

export const QuestionSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  prompt_ar: z.string(),
  choices: z.array(z.string()).length(4).optional(),
  answer: z.string(),
  rationale_ar: z.string(),
  vocab_lemma: z.string().nullable().optional(),
});

export const TestSchema = z.object({
  confidence: z.number().min(0).max(1),
  is_fallback: z.boolean(),
  fallback_passage_ar: z.string().optional().default(""),
  questions: z.array(QuestionSchema).length(12),
});

export type GeneratedTest = z.infer<typeof TestSchema>;

const PROMPT_VERSION = "v1";

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts", "test-system.md"),
  "utf8",
);

const SUBMIT_TEST_TOOL = {
  name: "submit_test",
  description:
    "Submit the generated 12-question Arabic comprehension test for the user's book.",
  input_schema: {
    type: "object",
    properties: {
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "0..1 confidence that the model has accurate training-knowledge of this exact book.",
      },
      is_fallback: {
        type: "boolean",
        description:
          "True when the model is generating a generic level-appropriate test because it does not know the book well.",
      },
      fallback_passage_ar: {
        type: "string",
        description:
          "If is_fallback, an Arabic passage the questions reference. Empty otherwise.",
      },
      questions: {
        type: "array",
        minItems: 12,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["mcq", "short", "vocab", "event"] },
            prompt_ar: { type: "string" },
            choices: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
            },
            answer: { type: "string" },
            rationale_ar: { type: "string" },
            vocab_lemma: { type: ["string", "null"] },
          },
          required: ["id", "type", "prompt_ar", "answer", "rationale_ar"],
        },
      },
    },
    required: ["confidence", "is_fallback", "questions"],
  },
} as const;

export type GenerateInput = {
  titleAr: string;
  titleEn: string;
  authorEn: string | null;
  level: number;
  genre: string;
};

export async function generateTest(input: GenerateInput): Promise<{
  test: GeneratedTest;
  model: string;
  promptVersion: string;
}> {
  const userMsg = `Generate a 12-question Arabic comprehension test for the following book.

Title (Arabic): ${input.titleAr}
Title (English): ${input.titleEn}
${input.authorEn ? `Author: ${input.authorEn}` : ""}
Genre: ${input.genre}
Learner level: ${input.level} of 8

Follow the system rules. Submit via the submit_test tool only.`;

  const response = await anthropic.messages.create({
    model: TEST_MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_TEST_TOOL as never],
    tool_choice: { type: "tool", name: "submit_test" },
    messages: [{ role: "user", content: userMsg }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const parsed = TestSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error("Test JSON failed validation: " + parsed.error.message);
  }

  return { test: parsed.data, model: TEST_MODEL, promptVersion: PROMPT_VERSION };
}
