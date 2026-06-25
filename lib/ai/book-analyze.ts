import { z } from "zod";
import { anthropic, TEST_MODEL } from "./anthropic";

export const BookAnalysisSchema = z.object({
  level: z.number().int().min(1).max(9),
  genre: z.enum(["islamic", "arabic_literature", "translated", "graded_reader", "classical"]),
  difficulty: z.number().int().min(1).max(5),
  blurb_en: z.string(),
  // A contiguous partition over the input pages: each chapter spans pages
  // first_page..last_page (1-based, inclusive). Lets us merge arbitrary EPUB
  // page-splits back into real chapters.
  chapters: z
    .array(
      z.object({
        title_ar: z.string(),
        title_en: z.string(),
        first_page: z.number().int().min(1),
        last_page: z.number().int().min(1),
      }),
    )
    .min(1),
});
export type BookAnalysis = z.infer<typeof BookAnalysisSchema>;

export type Page = { excerpt: string };

const MAX_PAGES = 240;

const SUBMIT = {
  name: "submit_analysis",
  description: "Submit the reading-level analysis and the real chapter structure.",
  input_schema: {
    type: "object",
    properties: {
      level: {
        type: "integer",
        description:
          "Reading stage 1-9. 1=absolute-beginner children's, 2=easy graded readers, 3=upper-beginner, 4=lower-intermediate, 5=intermediate novels, 6=upper-intermediate, 7=advanced classical prose, 8=very advanced classical, 9=scholarly reference. Judge by vocabulary, sentence length, abstraction.",
      },
      genre: {
        type: "string",
        enum: ["islamic", "arabic_literature", "translated", "graded_reader", "classical"],
      },
      difficulty: { type: "integer", description: "Relative difficulty 1-5 within the stage." },
      blurb_en: { type: "string", description: "One inviting English sentence about the book." },
      chapters: {
        type: "array",
        description:
          "The book's REAL chapters. The input is a list of numbered pages that may be arbitrary splits (often each page is a fragment, not a chapter). Group consecutive pages into the actual chapters by spotting chapter openings/headings (e.g. 'Chapter', 'الفصل', 'الباب', 'الحديث', a roman numeral, a title line). Each entry covers pages first_page..last_page inclusive. Ranges MUST be contiguous and cover every page exactly once: the first chapter starts at page 1, each next starts at the previous last_page+1, the final chapter ends at the last page. Drop nothing. If the pages already are real chapters, return one entry per page. Give a clean Arabic + English title for each chapter; invent a fitting one if the text has none.",
        items: {
          type: "object",
          properties: {
            title_ar: { type: "string" },
            title_en: { type: "string" },
            first_page: { type: "integer" },
            last_page: { type: "integer" },
          },
          required: ["title_ar", "title_en", "first_page", "last_page"],
        },
      },
    },
    required: ["level", "genre", "difficulty", "blurb_en", "chapters"],
  },
} as const;

export async function analyzeBook(input: {
  titleHint: string;
  sample: string;
  pages: Page[];
}): Promise<BookAnalysis> {
  const pages = input.pages.slice(0, MAX_PAGES);
  const payload = {
    title: input.titleHint,
    opening_sample: input.sample.slice(0, 2000),
    page_count: input.pages.length,
    pages: pages.map((p, i) => ({ n: i + 1, opening: p.excerpt.slice(0, 300) })),
  };

  const response = await anthropic.messages.create({
    model: TEST_MODEL,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: "You are a librarian for an Arabic graded-reading app. You receive a book's title, an opening sample, and its pages (each with opening text). Detect the real chapter structure by grouping consecutive pages into chapters, assess reading stage (1-9), genre and difficulty, and write a one-sentence English blurb. Reply only via the submit_analysis tool, returning a contiguous page partition that covers every page exactly once.",
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
