export type Strength = "new" | "weak" | "learning" | "strong" | "mastered";

export type StrengthInput = {
  repetitions: number;
  intervalDays: number;
  lapses: number;
  ease: number;
};

export function strengthFor(c: StrengthInput): Strength {
  if (c.repetitions === 0) return c.lapses > 0 ? "weak" : "new";
  if (c.ease <= 1.8 || c.lapses >= 3) return "weak";
  if (c.intervalDays >= 21) return "mastered";
  if (c.intervalDays >= 7) return "strong";
  return "learning";
}

export const STRENGTH_ORDER: Strength[] = ["new", "weak", "learning", "strong", "mastered"];

export const STRENGTH_LABELS: Record<Strength, { labelEn: string; labelAr: string }> = {
  new: { labelEn: "New", labelAr: "جديدة" },
  weak: { labelEn: "Weak", labelAr: "ضعيفة" },
  learning: { labelEn: "Learning", labelAr: "قيد التعلم" },
  strong: { labelEn: "Strong", labelAr: "قوية" },
  mastered: { labelEn: "Mastered", labelAr: "متقنة" },
};
