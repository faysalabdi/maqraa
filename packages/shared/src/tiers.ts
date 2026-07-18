export const TIERS = ["Beginner", "Intermediate", "Advanced"] as const;
export type Tier = (typeof TIERS)[number];

// Coarse difficulty tier from the advisory `level` band. Beginner = fully
// diacritized starters; Intermediate = matns / classic tales; Advanced = dense
// classical prose. This is what readers see ("what level am I at"), not CEFR.
export function tierFor(level: number): Tier {
  if (level <= 2) return "Beginner";
  if (level <= 4) return "Intermediate";
  return "Advanced";
}
