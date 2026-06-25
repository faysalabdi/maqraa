import { z } from "zod";
import { anthropic, TEST_MODEL } from "./anthropic";

export const BookAnalysisSchema = z.object({
  level: z.number().int().min(1).max(9),
  genre: z.enum(["islamic", "arabic_literature", "translated", "graded_reader", "classical"]),
  difficulty: z.number().int().min(1).max(5),
  blurb_en: z.string(),
  titles: z.array(z.object({ ar: z.string(), en: z.string() })).optional(),
});
export type BookAnalysis = z.infer<typeof BookAnalysisSchema>;

export type ChapterPreview = { title: string; excerpt: string };

// We only ever send Claude short excerpts, never whole books — level and genre
// read clearly from a sample, and titles from each chapter's opening lines.
const MAX_TITLED = 50;

const SUBMIT = {
  name: "submit_analysis",
  description: "Submit the reading-level analysis and cleaned chapter titles.",
  input_schema: {
    type: "object",
    properties: {
      level: {
        type: "integer",
        description:
          "Reading stage 1-9. 1=absolute-beginner children's stories, 2=easy graded readers, 3=upper-beginner, 4=lower-intermediate, 5=intermediate novels/literature, 6=upper-intermediate, 7=advanced classical prose, 8=very advanced classical, 9=scholarly reference. Judge by vocabulary, sentence length, and abstraction.",
      },
      genre: {
        type: "string",
        enum: ["islamic", "arabic_literature", "translated", "graded_reader", "classical"],
      },
      difficulty: { type: "integer", description: "Relative difficulty 1-5 within the chosen stage." },
      blurb_en: { type: "string", description: "One inviting English sentence describing the book." },
      titles: {
        type: "array",
        description:
          "Cleaned title for each chapter IN ORDER, same count as provided. Strip page numbers and noise; if a chapter has no real title, invent a short fitting one.",
        items: {
          type: "object",
          properties: {
            ar: { type: "string", description: "Arabic chapter title" },
            en: { type: "string", description: "Short English chapter title" },
          },
          required: ["ar", "en"],
        },
      },
    },
    required: ["level", "genre", "difficulty", "blurb_en"],
  },
} as const;

export async function analyzeBook(input: {
  titleHint: string;
  sample: string;
  chapters: ChapterPreview[];
}): Promise<BookAnalysis> {
  const titled = input.chapters.slice(0, MAX_TITLED);
  const payload = {
    title: input.titleHint,
    opening_sample: input.sample.slice(0, 2000),
    chapter_count: input.chapters.length,
    chapters: titled.map((c, i) => ({
      n: i + 1,
      current_title: c.title.slice(0, 80),
      opening: c.excerpt.slice(0, 200),
    })),
  };

  const response = await anthropic.messages.create({
    model: TEST_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: "You are a librarian for an Arabic graded-reading app. Given a book's title, an opening sample, and a list of its chapters (with opening lines), assess its reading stage (1-9), genre, and relative difficulty, write a one-sentence English blurb, and produce a clean Arabic + English title for each chapter in order. Reply only via the submit_analysis tool.",
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [SUBMIT as never],
    tool_choice: { type: "tool", name: "submit_analysis" },
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no analysis returned");
  return BookAnalysisSchema.parse(toolUse.input);
}
