import type { Skill } from "@/lib/xp/skills";

/**
 * Daily quests, computed from the day's xp_events — no quest tables. Three per
 * day: reading is always present (it's the core loop), the other two rotate so
 * listening, speaking, and vocab each get regular days in the spotlight.
 */

export type QuestDef = {
  id: string;
  title: string;
  description: string;
  skill: Skill;
  /** xp_reason whose event count drives progress. */
  reason: string;
  /** Number of events needed. */
  target: number;
};

export const QUEST_XP = 15;
export const ALL_QUESTS_BONUS_XP = 25;

const READING_QUEST: QuestDef = {
  id: "read-sections",
  title: "Pass 2 reading checks",
  description: "Finish two sections or chapter quizzes anywhere in the app.",
  skill: "reading",
  reason: "page_logged",
  target: 2,
};

const ROTATING: QuestDef[] = [
  {
    id: "srs-10",
    title: "Review 10 flashcards",
    description: "Clear ten cards from your review queue.",
    skill: "reading",
    reason: "srs_review",
    target: 10,
  },
  {
    id: "listen-1",
    title: "Pass a listening exercise",
    description: "Score at least 2/3 on one listening check.",
    skill: "listening",
    reason: "listening_passed",
    target: 1,
  },
  {
    id: "speak-5",
    title: "Hold a 5-turn conversation",
    description: "Send five messages in a practice conversation.",
    skill: "speaking",
    reason: "conversation_turn",
    target: 5,
  },
  {
    id: "words-3",
    title: "Grow your deck by 3 words",
    description: "Save or graduate three vocabulary words.",
    skill: "reading",
    reason: "vocab_learned",
    target: 3,
  },
];

// Every 2-combination of the rotating pool; cycled by day so consecutive days
// differ and all quests appear regularly.
const PAIRS: [number, number][] = [
  [1, 2], // listening + speaking
  [0, 3], // flashcards + words
  [1, 3], // listening + words
  [0, 2], // flashcards + speaking
  [2, 3], // speaking + words
  [0, 1], // flashcards + listening
];

function dayIndex(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/** The three quests for a given UTC date. Deterministic. */
export function questsForDate(date: Date): QuestDef[] {
  const [a, b] = PAIRS[dayIndex(date) % PAIRS.length];
  return [READING_QUEST, ROTATING[a], ROTATING[b]];
}

/** YYYY-MM-DD key used in claim refHashes. */
export function questDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
