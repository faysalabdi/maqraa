import { z } from "zod";
import { anthropic, TEST_MODEL } from "./anthropic";

export const STORY_TOPICS = [
  "an adventure or journey",
  "friendship and family",
  "a mystery to solve",
  "history or a historical figure",
  "animals and nature",
  "a funny everyday situation",
  "wisdom and life lessons",
  "the sea, travel, or faraway lands",
] as const;

export const GeneratedStorySchema = z.object({
  title_ar: z.string(),
  title_en: z.string(),
  content_ar: z.string().min(200),
});

export type GeneratedStory = z.infer<typeof GeneratedStorySchema>;

const SUBMIT_STORY_TOOL = {
  name: "submit_story",
  description: "Submit the generated Arabic story.",
  input_schema: {
    type: "object",
    properties: {
      title_ar: { type: "string", description: "Arabic title." },
      title_en: { type: "string", description: "English translation of the title." },
      content_ar: {
        type: "string",
        description:
          "The full story in Arabic. Paragraphs separated by blank lines. No headings inside the body, no translation.",
      },
    },
    required: ["title_ar", "title_en", "content_ar"],
  },
} as const;

const LEVEL_GUIDANCE: Record<number, string> = {
  1: "FULL tashkeel on every word. Very simple vocabulary (most common ~500 words), short sentences, present tense mostly, lots of repetition. 250-400 words.",
  2: "Full tashkeel. Simple vocabulary (~1000 most common words), short sentences, simple past and present. 300-500 words.",
  3: "Tashkeel only on less-common words. Everyday vocabulary, some connectors (ثم، لكن، لأن), varied tenses. 400-600 words.",
  4: "Light tashkeel on rare words only. Richer vocabulary, subordinate clauses, some idioms. 500-800 words.",
  5: "Minimal tashkeel. Literary flavor, varied sentence structure, abstract vocabulary welcome. 600-900 words.",
  6: "No tashkeel except where ambiguous. Literary prose with classical influences. 700-1000 words.",
  7: "Classical register welcome (after the style of the great prose writers). 700-1000 words.",
  8: "Full classical literary Arabic. 700-1100 words.",
};

export async function generateStory(input: {
  level: number;
  topicHint?: string;
}): Promise<GeneratedStory> {
  const guidance = LEVEL_GUIDANCE[input.level] ?? LEVEL_GUIDANCE[3];
  const topic =
    input.topicHint?.trim() ||
    STORY_TOPICS[Math.floor(Math.random() * STORY_TOPICS.length)];

  const response = await anthropic.messages.create({
    model: TEST_MODEL,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: "You are a master storyteller writing original Arabic stories for language learners, in the tradition of graded readers like القراءة الراشدة. Each story must be engaging — a real story with a beginning, a complication, and a satisfying ending — never a dry textbook passage. Write ONLY in Arabic in the story body. Calibrate language precisely to the requested level. Vary your stories: different settings, characters, and time periods each call. Submit only via the submit_story tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT_STORY_TOOL as never],
    tool_choice: { type: "tool", name: "submit_story" },
    messages: [
      {
        role: "user",
        content: `Write an original story about ${topic}.

Learner level: ${input.level} of 8.
Language requirements: ${guidance}`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no story returned");
  return GeneratedStorySchema.parse(toolUse.input);
}
