import { z } from "zod";
import { anthropic, TEST_MODEL } from "./anthropic";

export const SCENARIOS = [
  {
    slug: "introductions",
    nameEn: "Meeting someone new",
    nameAr: "التعارف",
    description: "Introduce yourself, ask about family, work, and where they're from.",
    partner: "a friendly student you just met at a study circle",
  },
  {
    slug: "market",
    nameEn: "At the market",
    nameAr: "في السوق",
    description: "Buy fruit and vegetables, ask prices, haggle politely.",
    partner: "a cheerful fruit seller in a busy souq",
  },
  {
    slug: "directions",
    nameEn: "Asking for directions",
    nameAr: "السؤال عن الطريق",
    description: "Find the mosque, the library, the bus stop.",
    partner: "a helpful passer-by on the street",
  },
  {
    slug: "restaurant",
    nameEn: "At the restaurant",
    nameAr: "في المطعم",
    description: "Order food, ask about dishes, request the bill.",
    partner: "a patient waiter in a small restaurant",
  },
  {
    slug: "bookshop",
    nameEn: "At the bookshop",
    nameAr: "في المكتبة",
    description: "Ask for book recommendations, discuss what you're reading.",
    partner: "a knowledgeable bookseller who loves classical literature",
  },
  {
    slug: "free-talk",
    nameEn: "Free conversation",
    nameAr: "حديث حر",
    description: "Talk about anything — your day, your goals, your reading.",
    partner: "a supportive Arabic teacher and conversation partner",
  },
] as const;

export type ScenarioSlug = (typeof SCENARIOS)[number]["slug"];

export const TurnSchema = z.object({
  reply_ar: z.string(),
  reply_translation_en: z.string(),
  correction: z
    .object({
      corrected_ar: z.string(),
      note_en: z.string(),
    })
    .nullable()
    .optional(),
  suggestion_ar: z.string().nullable().optional(),
});

export type ConversationTurn = z.infer<typeof TurnSchema>;

export type StoredMessage = {
  role: "user" | "partner";
  content_ar: string;
  translation_en?: string;
  correction?: { corrected_ar: string; note_en: string } | null;
};

const SUBMIT_TURN_TOOL = {
  name: "submit_turn",
  description: "Submit your conversational reply.",
  input_schema: {
    type: "object",
    properties: {
      reply_ar: {
        type: "string",
        description:
          "Your in-character reply in Modern Standard Arabic, 1-3 short sentences, with tashkeel on uncommon words.",
      },
      reply_translation_en: {
        type: "string",
        description: "Natural English translation of reply_ar.",
      },
      correction: {
        type: ["object", "null"],
        description:
          "If the learner's last message had a meaningful Arabic error, the corrected version and a one-line English note. Null if their Arabic was fine. Ignore missing tashkeel.",
        properties: {
          corrected_ar: { type: "string" },
          note_en: { type: "string" },
        },
        required: ["corrected_ar", "note_en"],
      },
      suggestion_ar: {
        type: ["string", "null"],
        description:
          "A short Arabic phrase the learner could use to continue the conversation. Null after the first few turns.",
      },
    },
    required: ["reply_ar", "reply_translation_en"],
  },
} as const;

const SYSTEM_PROMPT = `You are an Arabic conversation partner inside a language-learning app. You role-play everyday scenarios in Modern Standard Arabic (fusha) so the learner builds real conversational ability.

Rules:
- Stay in character for the scenario. Be warm, natural, and a little playful.
- Reply in 1-3 SHORT sentences of MSA. Match the learner's level: level 1-2 = very simple vocabulary and present tense, full tashkeel; level 3-4 = everyday vocabulary, light tashkeel on uncommon words; level 5+ = natural educated MSA.
- Always end your reply with a question or prompt that invites the learner to keep talking.
- If the learner writes in English or mixes languages, gently respond in Arabic and keep going — never switch to English in reply_ar.
- Corrections: only flag errors that impede meaning or are clearly wrong grammar. One correction max per turn. Never correct missing tashkeel.
- Submit only via the submit_turn tool.`;

export async function generateTurn(input: {
  scenario: ScenarioSlug;
  level: number;
  history: StoredMessage[];
  userMessage: string;
}): Promise<ConversationTurn> {
  const scenario = SCENARIOS.find((s) => s.slug === input.scenario) ?? SCENARIOS[5];

  const historyText = input.history
    .slice(-12)
    .map((m) => `${m.role === "user" ? "LEARNER" : "YOU"}: ${m.content_ar}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: TEST_MODEL,
    max_tokens: 1200,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_TURN_TOOL as never],
    tool_choice: { type: "tool", name: "submit_turn" },
    messages: [
      {
        role: "user",
        content: `Scenario: ${scenario.nameEn} — you are ${scenario.partner}.
Learner level: ${input.level} of 8.

Conversation so far:
${historyText || "(none yet — this is the opening)"}

LEARNER's new message: ${input.userMessage}`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("no turn returned");
  return TurnSchema.parse(toolUse.input);
}

export async function generateOpening(input: {
  scenario: ScenarioSlug;
  level: number;
}): Promise<ConversationTurn> {
  return generateTurn({
    ...input,
    history: [],
    userMessage:
      "(The learner just arrived. Greet them in character and open the scenario with a simple question.)",
  });
}
