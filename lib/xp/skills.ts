/**
 * Multi-skill ranks, derived entirely from the xp_events log — no migration,
 * and history counts retroactively. Reading is the core loop; listening and
 * speaking are parallel ranks that never gate the book path.
 */

export type Skill = "reading" | "listening" | "speaking";

export const SKILLS: Skill[] = ["reading", "listening", "speaking"];

/** xp_reason → skill. Reasons absent here (streak/level-up/achievement/quest
 * bonuses) count toward total XP only. */
const REASON_SKILL: Record<string, Skill> = {
  page_logged: "reading",
  minute_logged: "reading",
  book_completed: "reading",
  test_passed: "reading",
  perfect_score: "reading",
  vocab_learned: "reading",
  srs_review: "reading",
  listening_passed: "listening",
  conversation_turn: "speaking",
};

export function skillForReason(reason: string): Skill | null {
  return REASON_SKILL[reason] ?? null;
}

export const SKILL_META: Record<
  Skill,
  { label: string; labelAr: string; icon: "book" | "headphones" | "messages"; tone: string }
> = {
  reading: { label: "Reading", labelAr: "قراءة", icon: "book", tone: "emerald" },
  listening: { label: "Listening", labelAr: "استماع", icon: "headphones", tone: "sky" },
  speaking: { label: "Speaking", labelAr: "محادثة", icon: "messages", tone: "violet" },
};

/* ───────────────────────── weekly leaderboard tiers ───────────────────────── */

export type Tier = "bronze" | "silver" | "gold" | "emerald" | "diamond";

const TIER_THRESHOLDS: [Tier, number][] = [
  ["diamond", 2000],
  ["emerald", 900],
  ["gold", 400],
  ["silver", 150],
  ["bronze", 0],
];

export function tierForWeeklyXp(weeklyXp: number): Tier {
  for (const [tier, min] of TIER_THRESHOLDS) {
    if (weeklyXp >= min) return tier;
  }
  return "bronze";
}

/** XP still needed to reach the next tier, or null at diamond. */
export function xpToNextTier(weeklyXp: number): { tier: Tier; needed: number } | null {
  const ordered = [...TIER_THRESHOLDS].reverse(); // bronze → diamond
  for (const [tier, min] of ordered) {
    if (weeklyXp < min) return { tier, needed: min - weeklyXp };
  }
  return null;
}

export const TIER_META: Record<Tier, { label: string; badge: string; gradient: string }> = {
  bronze: {
    label: "Bronze",
    badge: "bg-orange-100 text-orange-900 ring-orange-300",
    gradient: "from-orange-300 to-orange-500",
  },
  silver: {
    label: "Silver",
    badge: "bg-zinc-100 text-zinc-800 ring-zinc-300",
    gradient: "from-zinc-300 to-zinc-500",
  },
  gold: {
    label: "Gold",
    badge: "bg-amber-100 text-amber-900 ring-amber-300",
    gradient: "from-amber-300 to-amber-500",
  },
  emerald: {
    label: "Emerald",
    badge: "bg-emerald-100 text-emerald-900 ring-emerald-300",
    gradient: "from-emerald-300 to-emerald-600",
  },
  diamond: {
    label: "Diamond",
    badge: "bg-sky-100 text-sky-900 ring-sky-300",
    gradient: "from-sky-300 to-indigo-500",
  },
};
